// API-Football (api-sports.io v3) HTTP mijozi: kesh → in-flight dedupe → kunlik byudjet →
// daqiqalik limiter → fetch (timeout). Kalit faqat `x-apisports-key` headerida; log/xato matnlarida YO'Q.

import { BadRequestError, NotFoundError, UpstreamError } from '../errors.js'
import { createBudget, createRateWindow } from './quota.js'

const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_PER_MINUTE = 8
const DEFAULT_MIN_BUDGET = 10
const MINUTE_MS = 60_000
const DEFAULT_MAX_QUEUE = 50
const DEFAULT_MAX_WAIT_MS = 20_000
const STATUS_TOO_MANY = 429
const STATUS_NOT_FOUND = 404
const STATUS_UNAVAILABLE = 503
const STATUS_BAD_GATEWAY = 502
const STATUS_TIMEOUT = 504
const SAFE_PATH = /^\/[a-z/]+$/
const SAFE_PARAM = /^[\p{L}\p{N} _\-./:']{1,80}$/u
const MAX_ERROR_TEXT = 200
// Doimiy API xatosi (masalan "plan": tarif bu mavsumga ruxsat bermaydi) — qayta so'rab kvotani yoqmaslik uchun
const API_ERROR_TTL_MS = 6 * 60 * 60 * 1000

/** Keshdagi negativ yozuv (doimiy API xatosi). */
const isErrorEntry = v => Boolean(v) && !Array.isArray(v) && typeof v.apiError === 'string'

/** Kesh kaliti: path + saralangan parametrlar. Parametrlar oq ro'yxat bo'yicha tekshiriladi. */
export function cacheKey(path, params = {}) {
  if (!SAFE_PATH.test(path)) throw new BadRequestError('apisports: yaroqsiz path')
  const pairs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => {
      const s = String(v)
      if (!/^[a-z]+$/.test(k) || !SAFE_PARAM.test(s)) throw new BadRequestError(`apisports: yaroqsiz parametr: ${k}`)
      return [k, s]
    })
    .sort(([a], [b]) => a.localeCompare(b))
  return `${path}?${new URLSearchParams(pairs)}`
}

/** API `errors` maydoni (massiv yoki obyekt) — bo'sh bo'lmasa qaytaradi. */
function apiErrors(body) {
  const e = body?.errors
  if (Array.isArray(e)) return e.length ? e : null
  if (e && typeof e === 'object' && Object.keys(e).length) return e
  return null
}

export class ApiClient {
  /**
   * @param {{ baseUrl: string, key: string, store: import('./disk-cache.js').DiskCache, fetchImpl?: typeof fetch,
   *   logger?: Pick<Console, 'warn'>, now?: () => number, timeoutMs?: number, perMinute?: number,
   *   windowMs?: number, minBudget?: number, maxQueue?: number, maxWaitMs?: number }} o
   */
  constructor(o) {
    if (typeof o.key !== 'string' || !o.key.trim()) throw new Error('APISPORTS_KEY sozlanmagan')
    if (!/^https:\/\//.test(o.baseUrl ?? '')) throw new Error('APISPORTS_BASE_URL https:// bilan boshlanishi kerak')
    const now = o.now ?? Date.now
    this.key = o.key
    this.baseUrl = o.baseUrl.replace(/\/$/, '')
    this.store = o.store
    this.logger = o.logger ?? console
    this.fetchImpl = o.fetchImpl ?? ((...args) => globalThis.fetch(...args))
    this.timeoutMs = o.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.acquire = createRateWindow({
      limit: o.perMinute ?? DEFAULT_PER_MINUTE,
      windowMs: o.windowMs ?? MINUTE_MS,
      maxQueue: o.maxQueue ?? DEFAULT_MAX_QUEUE,
      maxWaitMs: o.maxWaitMs ?? DEFAULT_MAX_WAIT_MS,
      now,
    })
    this.budget = createBudget({ store: o.store, minBudget: o.minBudget ?? DEFAULT_MIN_BUDGET, now })
    this.inflight = new Map()
    this.counters = { fetches: 0, hits: 0, stale: 0 }
  }

  /** Matndan kalitni (har ehtimolga qarshi) olib tashlaydi. */
  redact(text) {
    return String(text).split(this.key).join('[redacted]').slice(0, MAX_ERROR_TEXT)
  }

  failure(message, status = STATUS_UNAVAILABLE, cause) {
    return new UpstreamError(this.redact(message), { status, cause })
  }

  async send(k) {
    await this.acquire()
    this.counters.fetches++
    try {
      return await this.fetchImpl(this.baseUrl + k, {
        headers: { 'x-apisports-key': this.key },
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch (err) {
      const timeout = err?.name === 'TimeoutError' || err?.name === 'AbortError'
      const what = timeout ? 'timeout' : "ulanib bo'lmadi"
      throw this.failure(`API-Football ${what}: ${k}`, timeout ? STATUS_TIMEOUT : STATUS_BAD_GATEWAY)
    }
  }

  /** Bitta real so'rov: status, JSON, `errors` maydoni, `response` massivi tekshiriladi. */
  async fetchOnce(k) {
    const res = await this.send(k)
    this.budget.record(res.headers.get('x-ratelimit-requests-remaining'))
    if (res.status === STATUS_TOO_MANY) {
      this.budget.exhaust()
      throw this.failure(`API-Football 429 (limit): ${k}`)
    }
    if (res.status === STATUS_NOT_FOUND) throw new NotFoundError(`API-Football 404: ${k}`)
    if (!res.ok) throw this.failure(`API-Football ${res.status}: ${k}`, STATUS_BAD_GATEWAY)
    let body
    try {
      body = await res.json()
    } catch (err) {
      throw this.failure(`API-Football yaroqsiz JSON: ${k}`, STATUS_BAD_GATEWAY, err)
    }
    const errs = apiErrors(body)
    if (errs) {
      const text = this.redact(JSON.stringify(errs))
      const limit = !Array.isArray(errs) && ('requests' in errs || 'rateLimit' in errs)
      if (limit) this.budget.exhaust()
      // limit emas (plan/token/parametr) — doimiy: 6 soat negativ kesh, kvota qayta sarflanmaydi
      else this.store.set(k, { apiError: text }, API_ERROR_TTL_MS)
      this.logger.warn(`[apisports] API xatosi ${k}: ${text}`)
      throw this.failure(`API-Football xatosi: ${k}`)
    }
    if (!Array.isArray(body?.response)) throw this.failure(`API-Football yaroqsiz javob: ${k}`, STATUS_BAD_GATEWAY)
    return body.response
  }

  /** Kutilayotgan so'rov (dedupe): muvaffaqiyatda keshga yoziladi. */
  pending(k, ttl) {
    if (!this.inflight.has(k)) {
      const p = this.fetchOnce(k)
        .then(data => {
          this.store.set(k, data, typeof ttl === 'function' ? ttl(data) : ttl)
          return data
        })
        .finally(() => this.inflight.delete(k))
      this.inflight.set(k, p)
    }
    return this.inflight.get(k)
  }

  staleOf(cached) {
    this.counters.stale++
    return { data: cached.value, stale: true }
  }

  /**
   * @param {string} path
   * @param {Record<string, string | number | undefined>} params
   * @param {number | ((data: unknown[]) => number)} ttl  ms yoki javobga qarab
   * @returns {Promise<{ data: unknown[], stale: boolean }>}
   */
  async get(path, params, ttl) {
    const k = cacheKey(path, params)
    const entry = this.store.get(k)
    if (entry?.fresh && isErrorEntry(entry.value)) throw this.failure(`API-Football xatosi (keshdan): ${k}`)
    const cached = entry && !isErrorEntry(entry.value) ? entry : undefined
    if (cached?.fresh) {
      this.counters.hits++
      return { data: cached.value, stale: false }
    }
    if (this.budget.exhausted()) {
      if (cached) return this.staleOf(cached)
      throw this.failure(`API-Football kunlik kvotasi tugagan (keshda yo'q): ${k}`)
    }
    try {
      return { data: await this.pending(k, ttl), stale: false }
    } catch (err) {
      if (!(err instanceof UpstreamError) || !cached) throw err
      this.logger.warn(`[apisports] ${err.message} → eskirgan kesh beriladi`)
      return this.staleOf(cached)
    }
  }

  stats() {
    return { ...this.counters, budget: this.budget.remaining() }
  }

  flush() {
    this.store.flush()
  }
}

export const createClient = o => new ApiClient(o)
