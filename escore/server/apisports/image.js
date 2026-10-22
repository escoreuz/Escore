// Rasm proksisi: media.api-sports.io (kunlik limitga kirmaydi, kalit YUBORILMAYDI).
// Faqat image/* (aks holda UpstreamError), 404 → NotFoundError, hajm oqim bo'yicha cheklangan,
// timeout, alohida limiter, LRU xotira keshi va 404 uchun qisqa negativ kesh.

import { BadRequestError, NotFoundError, UpstreamError } from '../errors.js'
import { createTtlCache } from '../sofa/cache.js'
import { createLimiter } from '../sofa/limiter.js'

const MEDIA_BASE = 'https://media.api-sports.io/football'
const KIND_PATH = new Map([
  ['team', 'teams'],
  ['tournament', 'leagues'],
  ['player', 'players'],
  ['manager', 'coachs'],
])
const ID_RE = /^\d{1,10}$/
const TIMEOUT_MS = 10_000
const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const IMAGE_TTL_MS = 24 * 60 * 60 * 1000
const NOT_FOUND_TTL_MS = 60 * 60 * 1000
const IMAGE_CONCURRENCY = 4
const IMAGE_MAX_QUEUE = 100
const IMAGE_MAX_WAIT_MS = 8000
const CACHE_MAX_IMAGES = 300
const CACHE_MAX_BYTES = 10 * 1024 * 1024
const NOT_FOUND_MAX_KEYS = 1000

/**
 * @param {{ fetchImpl?: typeof fetch }} [options]
 */
export function createImageFetcher({ fetchImpl = (...a) => globalThis.fetch(...a) } = {}) {
  const limiter = createLimiter({
    concurrency: IMAGE_CONCURRENCY,
    maxQueue: IMAGE_MAX_QUEUE,
    maxWaitMs: IMAGE_MAX_WAIT_MS,
    name: 'rasm',
  })
  const cache = createTtlCache({ maxEntries: CACHE_MAX_IMAGES, maxWeight: CACHE_MAX_BYTES })
  const missing = createTtlCache({ maxEntries: NOT_FOUND_MAX_KEYS })
  const inflight = new Map()

  async function readLimited(res, url) {
    const declared = Number(res.headers.get('content-length'))
    if (declared > MAX_IMAGE_BYTES) throw new UpstreamError(`rasm juda katta: ${url}`)
    const chunks = []
    let size = 0
    for await (const chunk of res.body ?? []) {
      size += chunk.length
      if (size > MAX_IMAGE_BYTES) throw new UpstreamError(`rasm juda katta: ${url}`)
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  }

  async function load(url) {
    let res
    try {
      res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    } catch (err) {
      throw new UpstreamError(`rasm yuklanmadi: ${url}`, { status: err?.name === 'TimeoutError' ? 504 : 502 })
    }
    if (res.status === 404) throw new NotFoundError(`rasm yo'q: ${url}`)
    if (!res.ok) throw new UpstreamError(`rasm ${res.status}: ${url}`)
    const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    if (!type.startsWith('image/')) throw new UpstreamError(`rasm emas (${type || "turi yo'q"}): ${url}`)
    return { buf: await readLimited(res, url), type }
  }

  return function fetchImage(kind, id) {
    const dir = KIND_PATH.get(kind)
    if (!dir) return Promise.reject(new NotFoundError(`API-Football'da rasm turi yo'q: ${kind}`))
    if (!ID_RE.test(String(id))) return Promise.reject(new BadRequestError('rasm id yaroqsiz'))
    const url = `${MEDIA_BASE}/${dir}/${id}.png`
    const hit = cache.get(url)
    if (hit) return Promise.resolve(hit)
    const miss = missing.get(url)
    if (miss) return Promise.reject(miss)
    if (!inflight.has(url)) {
      const p = limiter(() => load(url))
        .then(img => {
          cache.set(url, img, IMAGE_TTL_MS, img.buf.length)
          return img
        })
        .catch(err => {
          if (err instanceof NotFoundError) missing.set(url, err, NOT_FOUND_TTL_MS)
          throw err
        })
        .finally(() => inflight.delete(url))
      inflight.set(url, p)
    }
    return inflight.get(url)
  }
}
