// eSCORE backend bilan ishlovchi API-klient: timeout, bekor qilish, GET keshi, in-flight dedupe, useApi hook
import { useCallback, useEffect, useRef, useState } from 'react'

export const REQUEST_TIMEOUT_MS = 15_000
export const CACHE_TTL_MS = 30_000
export const CACHE_MAX_ENTRIES = 200
const DEV_DEFAULT_BASE = 'http://localhost:4500'

const MESSAGES = {
  NETWORK: "Server bilan aloqa yo'q",
  TIMEOUT: 'Server javob bermadi (vaqt tugadi)',
  BAD_RESPONSE: "API manzili noto'g'ri sozlangan",
  CONFIG: 'API manzili sozlanmagan (VITE_API_URL)',
  BAD_REQUEST: "So'rov noto'g'ri",
  UNAUTHORIZED: 'Avtorizatsiya talab qilinadi',
  FORBIDDEN: "Ruxsat yo'q",
  NOT_FOUND: 'Topilmadi',
  RATE_LIMITED: "So'rovlar juda ko'p",
  UPSTREAM_UNAVAILABLE: "Ma'lumot manbai vaqtincha ishlamayapti",
  INTERNAL: 'Server xatosi',
  HTTP_ERROR: "So'rov bajarilmadi",
}

// API xatosi: status (HTTP, tarmoq/timeout uchun 0) va mashina o'qiydigan code
export class ApiError extends Error {
  constructor(message, { status = 0, code = 'HTTP_ERROR', cause } = {}) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

// Prototip kalitlari (__proto__, constructor) matn sifatida qaytmasligi uchun Object.hasOwn
const messageFor = code => (Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : MESSAGES.HTTP_ERROR)
const apiError = (code, status = 0, cause) => new ApiError(messageFor(code), { status, code, cause })

export const isAbortError = e => e?.name === 'AbortError'
const abortError = () => new DOMException("So'rov bekor qilindi", 'AbortError')

const LOOPBACK_RE = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i

/**
 * API manzilini aniqlaydi. Hostname-only qiymatga https:// qo'shiladi (Render),
 * sxemasiz loopback (localhost, 127.0.0.1, [::1]) uchun esa http://.
 * Production'da qiymat bo'lmasa localhost'ga EMAS — aniq konfiguratsiya xatosi qaytadi.
 * @param {string|undefined} raw
 * @param {boolean} isProd
 * @returns {{ base: string|null, error: ApiError|null }}
 */
export function resolveBase(raw, isProd) {
  const value = (raw || '').trim().replace(/\/+$/, '')
  if (!value) {
    return isProd ? { base: null, error: apiError('CONFIG') } : { base: DEV_DEFAULT_BASE, error: null }
  }
  if (/^https?:\/\//i.test(value)) return { base: value, error: null }
  const scheme = LOOPBACK_RE.test(value) ? 'http://' : 'https://'
  return { base: scheme + value, error: null }
}

const { base: BASE, error: BASE_ERROR } = resolveBase(import.meta.env.VITE_API_URL, import.meta.env.PROD)
if (BASE_ERROR) console.error('[api]', BASE_ERROR.message)

// ---- GET keshi (chegaralangan: TTL + maksimal yozuvlar soni) ----
// Siqib chiqarish FIFO (yozilish tartibi bo'yicha, LRU emas): to'lganda eng eski yozilgan yozuv o'chadi.
// Qiymatlar iste'molchilar o'rtasida umumiy — sayoz Object.freeze qilinadi; ichki obyektlarni ham
// o'zgartirmang (kerak bo'lsa nusxa oling: [...arr], { ...obj }).
const cache = new Map()

function cacheGet(path) {
  const hit = cache.get(path)
  if (!hit) return null
  if (hit.expires <= Date.now()) {
    cache.delete(path)
    return null
  }
  return hit
}

function cacheSet(path, value) {
  if (value !== null && typeof value === 'object') Object.freeze(value)
  cache.delete(path)
  cache.set(path, { value, expires: Date.now() + CACHE_TTL_MS })
  while (cache.size > CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value)
}

// Testlar va majburiy yangilash uchun: kesh va in-flight yozuvlarni tozalaydi
export function clearApiCache() {
  cache.clear()
  inflight.clear()
}

// ---- Transport ----
function errorForStatus(status) {
  if (status === 400) return 'BAD_REQUEST'
  if (status === 401) return 'UNAUTHORIZED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  if (status === 429) return 'RATE_LIMITED'
  if (status === 503) return 'UPSTREAM_UNAVAILABLE'
  if (status >= 500) return 'INTERNAL'
  return 'HTTP_ERROR'
}

// JSON bo'lmagan javob: 2xx/404 HTML odatda SPA/statik hostdan keladi → API manzili noto'g'ri
function nonJsonError(status) {
  if (status < 400 || status === 404) return apiError('BAD_RESPONSE', status)
  return apiError(errorForStatus(status), status)
}

function serverError(status, body) {
  const code = typeof body?.code === 'string' && body.code ? body.code : errorForStatus(status)
  const message = typeof body?.error === 'string' && body.error ? body.error : messageFor(code)
  return new ApiError(message, { status, code })
}

async function readJson(res) {
  const type = res.headers.get('content-type') || ''
  if (!type.toLowerCase().includes('application/json')) throw nonJsonError(res.status)
  let body
  try {
    body = await res.json()
  } catch (e) {
    if (isAbortError(e)) throw e
    throw apiError('BAD_RESPONSE', res.status, e)
  }
  if (!res.ok) throw serverError(res.status, body)
  return body
}

async function fetchJson(url, signal, isTimedOut) {
  try {
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
    return await readJson(res)
  } catch (e) {
    if (e instanceof ApiError) throw e
    if (isTimedOut()) throw apiError('TIMEOUT', 0, e)
    if (isAbortError(e)) throw e
    throw apiError('NETWORK', 0, e)
  }
}

// ---- In-flight dedupe: bir xil path uchun bitta tarmoq so'rovi, obunachilar soni bilan ----
const inflight = new Map()

function startRequest(path) {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)
  const entry = { controller, subscribers: 0, settled: false, promise: null }
  entry.promise = fetchJson(BASE + path, controller.signal, () => timedOut)
    .then(data => {
      cacheSet(path, data)
      return data
    })
    .finally(() => {
      clearTimeout(timer)
      entry.settled = true
      if (inflight.get(path) === entry) inflight.delete(path)
    })
  inflight.set(path, entry)
  return entry
}

// Oxirgi obunachi ketsa — tarmoq so'rovi bekor qilinadi. Mikrotask: StrictMode'dagi
// darhol qayta obuna bo'lish (unmount → mount) so'rovni keraksiz uzmasligi uchun.
function release(path, entry) {
  entry.subscribers -= 1
  queueMicrotask(() => {
    if (entry.subscribers > 0 || entry.settled) return
    if (inflight.get(path) === entry) inflight.delete(path)
    entry.controller.abort()
  })
}

function subscribe(path, entry, signal) {
  entry.subscribers += 1
  return new Promise((resolve, reject) => {
    let done = false
    const finish = (fn, value) => {
      if (done) return
      done = true
      signal?.removeEventListener('abort', onAbort)
      fn(value)
    }
    const onAbort = () => {
      if (done) return
      release(path, entry)
      finish(reject, abortError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    entry.promise.then(
      value => {
        if (!done) entry.subscribers -= 1
        finish(resolve, value)
      },
      error => {
        if (!done) entry.subscribers -= 1
        finish(reject, error)
      },
    )
  })
}

/**
 * GET so'rov. Kesh 30 s; `fresh: true` keshni chetlab o'tadi (polling/reload).
 * @param {string} path '/api/...'
 * @param {{ signal?: AbortSignal, fresh?: boolean }} [opts]
 */
function get(path, { signal, fresh = false } = {}) {
  if (!BASE) return Promise.reject(BASE_ERROR)
  if (signal?.aborted) return Promise.reject(abortError())
  if (!fresh) {
    const hit = cacheGet(path)
    if (hit) return Promise.resolve(hit.value)
  }
  const entry = inflight.get(path) || startRequest(path)
  return subscribe(path, entry, signal)
}

const enc = encodeURIComponent

// Bo'sh (undefined/null/'') parametrlar so'rovga qo'shilmaydi
function qs(params) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? '?' + s : ''
}

const pageParam = page => (Number.isInteger(page) && page > 0 ? page : undefined)

// Har metod oxirgi argument sifatida { signal, fresh } qabul qiladi
export const api = {
  base: BASE,
  bootstrap: opts => get('/api/bootstrap', opts),
  home: opts => get('/api/home', opts),
  news: opts => get('/api/news', opts),
  article: (slug, opts) => get('/api/news/' + enc(slug), opts),
  search: (q, opts) => get('/api/search' + qs({ q }), opts),
  feed: opts => get('/api/feed', opts),
  newsArticle: (slug, opts) => get('/api/feed/' + enc(slug), opts),
  archive: ({ q, category, page } = {}, opts) =>
    get('/api/archive' + qs({ q: q?.trim(), category, page: pageParam(page) }), opts),
  countries: opts => get('/api/countries', opts),
  countryLeagues: (id, opts) => get('/api/countries/' + enc(id) + '/leagues', opts),
  rankings: (kind, opts) => get('/api/rankings/' + enc(kind), opts),
  days: opts => get('/api/days', opts),
  matches: ({ date, status = 'all', q } = {}, opts) => get('/api/matches' + qs({ date, status, q: q?.trim() }), opts),
  match: (id, opts) => get('/api/matches/' + enc(id), opts),
  featured: opts => get('/api/featured', opts),
  scorers: opts => get('/api/scorers', opts),
  standingsMini: opts => get('/api/standings-mini', opts),
  league: (id, season, opts) => get('/api/leagues/' + enc(id) + qs({ season }), opts),
  team: (id, opts) => get('/api/teams/' + enc(id), opts),
  player: (id, opts) => get('/api/players/' + enc(id), opts),
  playerCareer: (id, opts) => get('/api/players/' + enc(id) + '/career', opts),
  playerSeason: (id, tid, sid, opts) => get(`/api/players/${enc(id)}/season` + qs({ tid, sid }), opts),
  coach: (id, opts) => get('/api/coaches/' + enc(id), opts),
  referee: (id, opts) => get('/api/referees/' + enc(id), opts),
  // Rasm URL (logo/o'yinchi/...) — to'g'ridan-to'g'ri <img src> uchun; API sozlanmagan bo'lsa null
  img: (kind, id) => (BASE ? `${BASE}/api/img/${enc(kind)}/${enc(id)}` : null),
}

// ---- useApi ----
const PENDING = Object.freeze({ data: null, error: null, loading: true })

/**
 * Ma'lumot yuklovchi hook.
 * `fn({ signal, fresh })` — Promise qaytaradi; `deps` — primitiv qiymatlar massivi (JSON kalitga aylanadi).
 * Kalit o'zgarsa eski data bir kadr ham ko'rinmaydi; unmount/kalit o'zgarishida so'rov bekor qilinadi.
 * @returns {{ data: any, error: Error|null, loading: boolean, reload: () => void }}
 */
export function useApi(fn, deps = []) {
  const key = JSON.stringify(deps)
  const fnRef = useRef(fn)
  const freshRef = useRef(false)
  const [nonce, setNonce] = useState(0)
  const [state, setState] = useState({ key: null, ...PENDING })

  // Har renderdagi eng so'nggi fn — effekt uni deps'ga qo'shmasdan chaqiradi
  useEffect(() => {
    fnRef.current = fn
  })

  useEffect(() => {
    const controller = new AbortController()
    const fresh = freshRef.current
    freshRef.current = false
    Promise.resolve()
      .then(() => {
        // Kalit o'zgarishi/unmount mikrotaskdan oldin bo'lsa — so'rovni umuman boshlamaymiz
        if (controller.signal.aborted) return undefined
        return fnRef.current({ signal: controller.signal, fresh })
      })
      .then(data => {
        if (!controller.signal.aborted) setState({ key, data, error: null, loading: false })
      })
      .catch(error => {
        if (controller.signal.aborted || isAbortError(error)) return
        if (!(error instanceof ApiError)) console.error('[useApi]', error)
        setState({ key, data: null, error, loading: false })
      })
    return () => controller.abort()
  }, [key, nonce])

  const reload = useCallback(() => {
    freshRef.current = true
    setState(s => ({ ...s, error: null, loading: true }))
    setNonce(n => n + 1)
  }, [])

  const current = state.key === key ? state : PENDING
  return { data: current.data, error: current.error, loading: current.loading, reload }
}
