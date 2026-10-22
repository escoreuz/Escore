// score-api (lokal FastAPI, SofaScore ma'lumoti) bilan HTTP qatlami:
// timeout, xato klassifikatsiyasi, path himoyasi, TTL kesh + in-flight deduplikatsiya,
// umumiy parallellik cheklovi (navbat chegaralangan).
//
// Diqqat: SofaScore anti-bot blokini aylanib o'tish (impersonate, proksi, header hiylalari)
// TAQIQLANGAN — 403 bo'lsa halol UpstreamError qaytaramiz.

import { BadRequestError, NotFoundError, UpstreamError } from '../errors.js'
import { createTtlCache } from './cache.js'
import { createLimiter } from './limiter.js'

// Render'da SCORE_API faqat hostname bo'lishi mumkin — protokol bo'lmasa https:// qo'shamiz.
const RAW_API = process.env.SCORE_API || 'http://localhost:8000'
export const API = /^https?:\/\//.test(RAW_API) ? RAW_API : 'https://' + RAW_API

const DEFAULT_TIMEOUT_MS = 10_000
const MAX_TIMEOUT_MS = 60_000
const SECOND = 1000
const MINUTE = 60 * SECOND
const TTL_LIVE_MS = 15 * SECOND
const TTL_NEWS_MS = 5 * MINUTE
const TTL_STATIC_MS = 10 * MINUTE
export const TTL_NOT_FOUND_MS = 60 * SECOND
const CACHE_MAX_KEYS = 1000
const UPSTREAM_CONCURRENCY = 8
const UPSTREAM_MAX_QUEUE = 200
const UPSTREAM_MAX_WAIT_MS = 15 * SECOND
const STATUS_NOT_FOUND = 404
const STATUS_BAD_GATEWAY = 502
const STATUS_GATEWAY_TIMEOUT = 504

function readTimeout() {
  const raw = Number(process.env.SOFA_TIMEOUT_MS)
  return Number.isInteger(raw) && raw > 0 && raw <= MAX_TIMEOUT_MS ? raw : DEFAULT_TIMEOUT_MS
}
const TIMEOUT_MS = readTimeout()

const defaultLimiter = createLimiter({
  concurrency: UPSTREAM_CONCURRENCY,
  maxQueue: UPSTREAM_MAX_QUEUE,
  maxWaitMs: UPSTREAM_MAX_WAIT_MS,
})

// Kalit: path+query → Promise (natija yoki kutilayotgan so'rov)
const cache = createTtlCache({ maxEntries: CACHE_MAX_KEYS })

// Ruxsat etilgan path segmenti: faqat xavfsiz belgilar; '.', '..', '%', '?', '#', '\' yo'q.
const SAFE_SEGMENT = /^[A-Za-z0-9_\-.~]+$/

/**
 * Path himoyasi (T-01 validatsiyasidan keyingi qo'shimcha qatlam) → BadRequestError.
 * @param {string} path
 */
export function assertSafePath(path) {
  if (typeof path !== 'string' || !path.startsWith('/')) throw new BadRequestError(`sofa: yaroqsiz path`)
  for (const seg of path.slice(1).split('/')) {
    if (!SAFE_SEGMENT.test(seg) || seg === '.' || seg === '..') {
      throw new BadRequestError(`sofa: xavfsiz bo'lmagan path segmenti rad etildi: ${JSON.stringify(seg)}`)
    }
  }
}

/** @param {Record<string, string | number> | undefined} query */
function buildQuery(query) {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (typeof v !== 'string' && typeof v !== 'number') throw new BadRequestError(`sofa: yaroqsiz query qiymati: ${k}`)
    params.set(k, String(v))
  }
  const s = params.toString()
  return s ? `?${s}` : ''
}

/** Path bo'yicha kesh muddati. */
export function ttlFor(path) {
  if (path.startsWith('/events/')) return TTL_LIVE_MS
  if (path === '/news' || path.startsWith('/news/')) return TTL_NEWS_MS
  return TTL_STATIC_MS
}

function isTimeout(err) {
  return err?.name === 'TimeoutError' || err?.name === 'AbortError'
}

/** fetch xatosini (tarmoq/timeout) UpstreamError ga aylantiradi. */
function networkError(err, path) {
  if (isTimeout(err)) {
    return new UpstreamError(`score-api timeout (${TIMEOUT_MS} ms) ${path}`, {
      status: STATUS_GATEWAY_TIMEOUT,
      cause: err,
    })
  }
  return new UpstreamError(`score-api ulanib bo'lmadi ${path}`, { status: STATUS_BAD_GATEWAY, cause: err })
}

/** Javob statusini tekshiradi: 404 → NotFoundError, boshqa xato → UpstreamError. */
function assertOk(res, path) {
  if (res.status === STATUS_NOT_FOUND) throw new NotFoundError(`score-api 404 ${path}`)
  if (!res.ok) throw new UpstreamError(`score-api ${res.status} ${path}`, { status: STATUS_BAD_GATEWAY })
}

/** 200 javob tanasi kutilgan shaklda emas. */
export function invalidResponse(path, cause) {
  return new UpstreamError(`score-api yaroqsiz javob ${path}`, { status: STATUS_BAD_GATEWAY, cause })
}

/**
 * Xom so'rov (keshsiz): path himoyasi, timeout, status tekshiruvi. Javob tanasini `read` o'qiydi.
 * @template T
 * @param {string} pathWithQuery
 * @param {(res: Response) => Promise<T>} read
 * @param {{ limiter?: <R>(task: () => Promise<R>) => Promise<R> }} [options]
 * @returns {Promise<T>}
 */
export function request(pathWithQuery, read, { limiter = defaultLimiter } = {}) {
  try {
    assertSafePath(pathWithQuery.split('?')[0])
  } catch (err) {
    return Promise.reject(err)
  }
  return limiter(async () => {
    let res
    try {
      res = await fetch(API + pathWithQuery, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    } catch (err) {
      throw networkError(err, pathWithQuery)
    }
    assertOk(res, pathWithQuery)
    try {
      return await read(res)
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof UpstreamError) throw err
      if (isTimeout(err)) throw networkError(err, pathWithQuery)
      throw invalidResponse(pathWithQuery, err)
    }
  })
}

/** JSON tanasini o'qiydi; obyekt bo'lmasa — yaroqsiz javob. */
async function readJsonObject(res, path) {
  const data = await res.json()
  if (data === null || typeof data !== 'object' || Array.isArray(data)) throw invalidResponse(path)
  return data
}

/**
 * JSON so'rov: TTL kesh + bir xil kalit uchun in-flight deduplikatsiya.
 * Xato keshlanmaydi (faqat 404 — qisqa negativ kesh).
 * @param {string} path
 * @param {Record<string, string | number>} [query]
 * @returns {Promise<any>}
 */
export function j(path, query) {
  let key
  try {
    assertSafePath(path)
    key = path + buildQuery(query)
  } catch (err) {
    return Promise.reject(err) // har doim Promise qaytaradi (sinxron throw yo'q)
  }
  const hit = cache.get(key)
  if (hit) return hit

  const ttl = ttlFor(path)
  const promise = request(key, res => readJsonObject(res, key))
  // Kutilayotgan so'rov ham keshda (dedupe); tugagach muddat qo'yiladi.
  cache.set(key, promise, Infinity)
  // Faqat shu so'rovning o'z yozuvi yangilanadi (oraliqda almashtirilgan bo'lsa tegilmaydi).
  const isOwn = () => cache.peek(key) === promise
  promise.then(
    () => isOwn() && cache.touch(key, ttl),
    err => {
      if (!isOwn()) return
      if (err instanceof NotFoundError) cache.touch(key, TTL_NOT_FOUND_MS)
      else cache.delete(key)
    },
  )
  return promise
}

/** Testlar va boshqaruv uchun: keshni tozalash. */
export function clearCache() {
  cache.clear()
}
