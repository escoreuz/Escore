// Ingliz tilidagi yangilik sarlavhalarini o'zbekchaga tarjima qiluvchi modul.
// Avval futbol atamalari lug'ati (aniq va tez), keyin Google Translate (bepul,
// rasmiy bo'lmagan endpoint) zaxira sifatida. Muvaffaqiyatli natijalar LRU keshda
// (≤ 5000) saqlanadi; xato bo'lsa asl matn qaytadi, lekin keshlanmaydi.
// Tashqi so'rovlar: parallellik ≤ 4, navbat chegaralangan, har so'rovga 8 s timeout,
// uzun matn (> 1500 belgi) bo'laklarga bo'linadi.

// ---- Futbol atamalari lug'ati (kichik harflarda) ----
const GLOSSARY = new Map(
  Object.entries({
    'full highlights': "To'liq sharh",
    'extended highlights': 'Kengaytirilgan sharh',
    highlights: 'Sharh',
    'all goals': 'Barcha gollar',
    goals: 'Gollar',
    'goals and highlights': 'Gollar va sharh',
    'all goals and highlights': 'Barcha gollar va sharh',
    'match highlights': "O'yin sharhi",
    'post-match': "O'yindan keyin",
    'post match': "O'yindan keyin",
    'pre-match': "O'yin oldidan",
    interview: 'Intervyu',
    'press conference': 'Matbuot anjumani',
    reaction: 'Reaksiya',
    'best moments': 'Eng yaxshi lahzalar',
    'key moments': 'Asosiy lahzalar',
    penalty: 'Penalti',
    penalties: 'Penaltilar',
    'red card': 'Qizil kartochka',
    'great goal': 'Ajoyib gol',
  }),
)

const GT_URL = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=uz&dt=t&q='
const DEFAULT_CACHE_SIZE = 5000
const DEFAULT_CONCURRENCY = 4
const DEFAULT_TIMEOUT_MS = 8000
const DEFAULT_MAX_QUEUE = 1000
const MAX_CHUNK_LENGTH = 1500
// Bundan uzun matn keshlanmaydi: 5000 ta uzun yozuv xotirani ko'p egallaydi, qayta so'ralishi esa kam
const MAX_CACHED_TEXT_LENGTH = 4000
const FAILURE_LOG_INTERVAL_MS = 60_000
const HAS_LETTER = /\p{L}/u

// ---- LRU kesh: Map tartibi — eng eski birinchi ----
class LruCache {
  constructor(max) {
    this.max = max
    this.map = new Map()
  }
  get(key) {
    if (!this.map.has(key)) return undefined
    const value = this.map.get(key)
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }
  set(key, value) {
    this.map.delete(key)
    this.map.set(key, value)
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value)
  }
  get size() {
    return this.map.size
  }
}

// ---- Parallellik cheklovchisi (navbat ham chegaralangan) ----
function createLimiter(concurrency, maxQueue) {
  let active = 0
  const queue = []
  function next() {
    if (active >= concurrency || queue.length === 0) return
    active++
    const { task, resolve, reject } = queue.shift()
    Promise.resolve()
      .then(task)
      .then(resolve, reject)
      .finally(() => {
        active--
        next()
      })
  }
  return task =>
    new Promise((resolve, reject) => {
      if (queue.length >= maxQueue) return reject(new Error("tarjima navbati to'lgan"))
      queue.push({ task, resolve, reject })
      next()
    })
}

// ---- Uzun matnni gap/so'z chegarasida bo'laklarga bo'lish ----
function splitLong(piece, max) {
  const out = []
  let rest = piece
  while (rest.length > max) {
    const cut = rest.lastIndexOf(' ', max)
    const at = cut > 0 ? cut : max
    out.push(rest.slice(0, at))
    rest = rest.slice(at).trimStart()
  }
  if (rest) out.push(rest)
  return out
}

export function splitText(text, max = MAX_CHUNK_LENGTH) {
  if (text.length <= max) return [text]
  const chunks = []
  let current = ''
  for (const sentence of text.split(/(?<=[.!?…])\s+/)) {
    for (const piece of splitLong(sentence, max)) {
      if (current && current.length + 1 + piece.length > max) {
        chunks.push(current)
        current = piece
      } else {
        current = current ? `${current} ${piece}` : piece
      }
    }
  }
  if (current) chunks.push(current)
  return chunks
}

// Bir xil xato oqimida logni to'ldirib yubormaslik: daqiqasiga ko'pi bilan bitta yozuv
function createFailureLog(logger, now) {
  let last = -Infinity
  let suppressed = 0
  return err => {
    const t = now()
    if (t - last < FAILURE_LOG_INTERVAL_MS) return void suppressed++
    const extra = suppressed ? ` (+${suppressed} ta oldingi xato)` : ''
    logger.warn(`[translate] tarjima bo'lmadi: ${err?.message || err}${extra}`)
    last = t
    suppressed = 0
  }
}

function parseGoogle(data) {
  const segments = Array.isArray(data?.[0]) ? data[0] : []
  return segments.map(seg => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : '')).join('')
}

/**
 * Mustaqil tarjimon nusxasi (testlar fetch mock bilan ishlatadi).
 * @param {{ fetchImpl?: typeof fetch, cacheSize?: number, concurrency?: number, timeoutMs?: number,
 *   maxQueue?: number, logger?: Pick<Console, 'warn'>, now?: () => number }} [opts]
 */
export function createTranslator({
  fetchImpl = (...args) => globalThis.fetch(...args),
  cacheSize = DEFAULT_CACHE_SIZE,
  concurrency = DEFAULT_CONCURRENCY,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxQueue = DEFAULT_MAX_QUEUE,
  logger = console,
  now = Date.now,
} = {}) {
  const cache = new LruCache(cacheSize)
  const limit = createLimiter(concurrency, maxQueue)
  const logFailure = createFailureLog(logger, now)

  async function requestOnce(text) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const r = await fetchImpl(GT_URL + encodeURIComponent(text), { signal: ctrl.signal })
      if (!r.ok) throw new Error('gt ' + r.status)
      const out = parseGoogle(await r.json())
      if (!out.trim()) throw new Error("gt bo'sh javob")
      return out
    } finally {
      clearTimeout(timer)
    }
  }

  // Bitta matn: lug'at → kesh → Google → (xato) asl matn. ok=false — tarjima bo'lmadi
  async function translateOne(text) {
    const t = text == null ? '' : String(text).trim()
    if (!t) return { text: '', ok: true }
    const known = GLOSSARY.get(t.toLowerCase())
    if (known) return { text: known, ok: true }
    if (!HAS_LETTER.test(t)) return { text: t, ok: true } // faqat raqam/belgi (masalan "2:1")
    const hit = cache.get(t)
    if (hit !== undefined) return { text: hit, ok: true }
    try {
      const parts = await Promise.all(splitText(t).map(chunk => limit(() => requestOnce(chunk))))
      const out = parts.join(' ')
      if (t.length <= MAX_CACHED_TEXT_LENGTH) cache.set(t, out)
      return { text: out, ok: true }
    } catch (err) {
      logFailure(err)
      return { text: t, ok: false }
    }
  }

  async function translateBatch(texts) {
    const results = await Promise.all((Array.isArray(texts) ? texts : []).map(translateOne))
    return { texts: results.map(r => r.text), complete: results.every(r => r.ok) }
  }

  return {
    translate: async text => (await translateOne(text)).text,
    translateAll: async texts => (await translateBatch(texts)).texts,
    translateBatch,
    cacheSize: () => cache.size,
  }
}

const defaultTranslator = createTranslator()

/** Bitta matnni tarjima qiladi; tarjima bo'lmasa asl matn. @returns {Promise<string>} */
export const translate = text => defaultTranslator.translate(text)
/** Bir nechta matnni tarjima qiladi (tartib saqlanadi). @returns {Promise<string[]>} */
export const translateAll = texts => defaultTranslator.translateAll(texts)
/** @returns {Promise<{ texts: string[], complete: boolean }>} complete=false — birortasi tarjima bo'lmadi */
export const translateBatch = texts => defaultTranslator.translateBatch(texts)
