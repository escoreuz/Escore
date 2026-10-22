// Rasm proksisi: score-api dan binary olib uzatish.
// - Faqat image/* qabul qilinadi (200 + boshqa tur → UpstreamError); 404 → NotFoundError.
// - Hajm oqim bo'yicha cheklanadi (Content-Length bo'lmasa ham).
// - LRU xotira keshi (≤300 rasm, ≤10 MB umumiy), 404 uchun qisqa negativ kesh.
// - Alohida limiter (4 slot, navbat 100, kutish ≤8 s) — rasmlar JSON so'rovlarini bo'g'ib qo'ymaydi.

import { NotFoundError, UpstreamError } from '../errors.js'
import { createTtlCache } from './cache.js'
import { TTL_NOT_FOUND_MS, assertSafePath, request } from './http.js'
import { createLimiter } from './limiter.js'

const MAX_CACHED_IMAGES = 300
const MAX_CACHE_BYTES = 10 * 1024 * 1024
const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const IMAGE_TTL_MS = 60 * 60 * 1000
const MAX_NEGATIVE_KEYS = 1000
const STATUS_TOO_LARGE = 502
const IMAGE_CONCURRENCY = 4
const IMAGE_MAX_QUEUE = 100
const IMAGE_MAX_WAIT_MS = 8000

const limiter = createLimiter({
  concurrency: IMAGE_CONCURRENCY,
  maxQueue: IMAGE_MAX_QUEUE,
  maxWaitMs: IMAGE_MAX_WAIT_MS,
  name: 'rasm',
})
const cache = createTtlCache({ maxEntries: MAX_CACHED_IMAGES, maxWeight: MAX_CACHE_BYTES })
const notFound = createTtlCache({ maxEntries: MAX_NEGATIVE_KEYS })
/** @type {Map<string, Promise<{ buf: Buffer, type: string }>>} */
const inflight = new Map()

function tooLarge(path, size) {
  return new UpstreamError(`rasm juda katta (${size} bayt): ${path}`, { status: STATUS_TOO_LARGE })
}

/** Tanani oqim bo'yicha o'qiydi; limitdan oshsa to'xtatadi. */
async function readLimited(res, path) {
  if (!res.body) return Buffer.alloc(0)
  const chunks = []
  let size = 0
  for await (const chunk of res.body) {
    size += chunk.length
    if (size > MAX_IMAGE_BYTES) throw tooLarge(path, size) // for-await chiqishi oqimni bekor qiladi
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function readImage(res, path) {
  const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (!type.startsWith('image/')) throw new UpstreamError(`rasm emas (${type || "turi yo'q"}): ${path}`)
  const declared = Number(res.headers.get('content-length'))
  if (declared > MAX_IMAGE_BYTES) throw tooLarge(path, declared)
  return { buf: await readLimited(res, path), type }
}

function load(path) {
  return request(path, res => readImage(res, path), { limiter })
    .then(img => {
      cache.set(path, img, IMAGE_TTL_MS, img.buf.length)
      return img
    })
    .catch(err => {
      if (err instanceof NotFoundError) notFound.set(path, err, TTL_NOT_FOUND_MS)
      throw err
    })
    .finally(() => inflight.delete(path))
}

/**
 * @param {string} kind  oq ro'yxat T-01 da (team, player, ...)
 * @param {string | number} id
 * @returns {Promise<{ buf: Buffer, type: string }>}
 */
export function fetchImage(kind, id) {
  const path = `/images/${kind}/${id}`
  try {
    assertSafePath(path)
  } catch (err) {
    return Promise.reject(err)
  }
  const hit = cache.get(path)
  if (hit) return Promise.resolve(hit)
  const missing = notFound.get(path)
  if (missing) return Promise.reject(missing)
  const pending = inflight.get(path)
  if (pending) return pending
  const promise = load(path)
  inflight.set(path, promise)
  return promise
}

/** Testlar uchun: rasm keshlarini tozalash. */
export function clearImageCache() {
  cache.clear()
  notFound.clear()
  inflight.clear()
}
