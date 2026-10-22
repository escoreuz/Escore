// Yangiliklar arxivi — ko'rilgan har bir maqola JSON faylga saqlanadi
// (server/db/archive.json). Vaqt o'tib lenta yangilansa ham eski maqolalar
// arxivda qoladi va qidiriladi. To'liq matn ham saqlanadi (qidiruv + offline o'qish).
// Yozish: faqat haqiqiy o'zgarishda, debounce (≈3 s), async atomik (tmp + rename),
// bir vaqtda bitta yozish. Elementlar soni chegaralangan — eng eskisi o'chadi.
import * as nodeFs from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_DATA_DIR = join(__dirname, 'db')
const FILE_NAME = 'archive.json'
const DEFAULT_DEBOUNCE_MS = 3000
const DEFAULT_MAX_ITEMS = 3000
const DEFAULT_PAGE_SIZE = 24
const MAX_PAGE_SIZE = 50
const MAX_PAGE = 10000
const MAX_QUERY_LENGTH = 80
const SEC_PER_MIN = 60
const SEC_PER_HOUR = 3600
const SEC_PER_DAY = 86400
// Windows: antivirus/indekser faylni qisqa vaqt band qilsa rename EPERM/EBUSY/EACCES beradi
const RENAME_RETRY_DELAYS_MS = [50, 100, 200]
const RETRYABLE_RENAME_CODES = new Set(['EPERM', 'EBUSY', 'EACCES'])

const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v)

// Faqat win32 da vaqtinchalik band-xatolarda 3 marta qayta urinadi (50/100/200 ms)
export async function renameWithRetry(fsp, from, to, platform = process.platform) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fsp.rename(from, to)
    } catch (err) {
      const retryable = platform === 'win32' && RETRYABLE_RENAME_CODES.has(err.code)
      if (!retryable || attempt >= RENAME_RETRY_DELAYS_MS.length) throw err
      await delay(RENAME_RETRY_DELAYS_MS[attempt])
    }
  }
}

function readArchive(fs, file, logger) {
  let raw
  try {
    raw = fs.readFileSync(file, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') return { entries: new Map(), writable: true }
    // O'qib bo'lmagan faylni ustidan yozib yubormaslik uchun yozish o'chiriladi
    logger.error(`[archive] ${file} o'qilmadi (${err.code || err.message}); arxiv faqat xotirada ishlaydi`)
    return { entries: new Map(), writable: false }
  }
  let parsed
  let reason = null
  try {
    parsed = JSON.parse(raw)
    if (!isPlainObject(parsed)) reason = 'obyekt emas'
  } catch (err) {
    reason = `JSON xatosi: ${err.message}`
  }
  if (reason) {
    const target = `${file}.corrupt-${Date.now()}`
    try {
      fs.renameSync(file, target)
    } catch (err) {
      // Nusxa saqlanmadi — buzilgan faylni ustidan yozmaymiz, arxiv faqat xotirada
      logger.error(`[archive] ${file} buzilgan (${reason}), ko'chirib bo'lmadi (${err.code}); faqat xotirada`)
      return { entries: new Map(), writable: false }
    }
    logger.error(`[archive] ${file} buzilgan (${reason}); ${target} ga ko'chirildi, bo'sh arxiv bilan davom etiladi`)
    return { entries: new Map(), writable: true }
  }
  const entries = new Map(Object.entries(parsed).filter(([k, v]) => isPlainObject(v) && v.slug === k))
  return { entries, writable: true }
}

function relTime(iso, now) {
  const ts = Math.floor(new Date(iso).getTime() / 1000)
  if (!ts) return ''
  const diff = Math.abs(Math.floor(now / 1000 - ts))
  if (diff < SEC_PER_HOUR) return `${Math.max(1, Math.floor(diff / SEC_PER_MIN))} daqiqa oldin`
  if (diff < SEC_PER_DAY) return `${Math.floor(diff / SEC_PER_HOUR)} soat oldin`
  return `${Math.floor(diff / SEC_PER_DAY)} kun oldin`
}

function blocksText(a) {
  return Array.isArray(a.blocks) ? a.blocks.map(b => (typeof b?.text === 'string' ? b.text : '')).join(' ') : ''
}

const sameRecord = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function clampInt(v, min, max, fallback) {
  const n = Number.parseInt(v, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

// Fayl yozuvchi: debounce + bitta parallel yozish + atomik almashtirish
function createWriter({ fs, platform, file, entries, debounceMs, logger, writable }) {
  let dirty = false
  let timer = null
  let writing = null

  async function writeOnce() {
    dirty = false
    const json = JSON.stringify(Object.fromEntries(entries))
    const tmp = `${file}.tmp-${process.pid}`
    try {
      await fs.promises.mkdir(dirname(file), { recursive: true })
      await fs.promises.writeFile(tmp, json, 'utf8')
      await renameWithRetry(fs.promises, tmp, file, platform)
      return true
    } catch (err) {
      dirty = true // keyingi o'zgarishda qayta urinadi (avtomatik cheksiz retry yo'q)
      logger.error(`[archive] ${file} ga yozib bo'lmadi: ${err.message}`)
      await fs.promises
        .rm(tmp, { force: true })
        .catch(rmErr => logger.error(`[archive] tmp o'chmadi: ${rmErr.message}`))
      return false
    }
  }

  function drain() {
    if (!writing) {
      writing = (async () => {
        try {
          while (dirty && writable && (await writeOnce()));
        } finally {
          writing = null
        }
      })()
    }
    return writing
  }

  return {
    markDirty() {
      dirty = true
      if (timer || !writable) return
      timer = setTimeout(() => {
        timer = null
        drain()
      }, debounceMs)
      timer.unref?.()
    },
    async flush() {
      if (timer) clearTimeout(timer)
      timer = null
      if (writing) await writing // yozish davomida kelgan o'zgarishlar ham yoziladi
      await drain()
    },
    isDirty: () => dirty,
  }
}

// Chegaradan oshsa eng eski (savedAt bo'yicha) elementlar o'chadi
function evictOldest(entries, maxItems) {
  const excess = entries.size - maxItems
  if (excess <= 0) return
  const oldest = [...entries.values()].sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0)).slice(0, excess)
  for (const rec of oldest) entries.delete(rec.slug)
}

// ---- Yozuv shakllari ----
// Bo'sh satr/bo'sh massiv/null — "qiymat yo'q": avvalgi saqlangan qiymat o'chirilmaydi
function filled(v) {
  if (Array.isArray(v)) return v.length ? v : undefined
  if (typeof v === 'string') return v.trim() ? v : undefined
  return v ?? undefined
}

const cardRecord = (it, prev, now) => ({
  ...prev,
  slug: it.slug,
  id: it.id ?? prev.id,
  title: filled(it.title) ?? prev.title,
  subtitle: filled(it.subtitle) ?? prev.subtitle ?? '',
  image: filled(it.image) ?? prev.image,
  league: filled(it.league) ?? prev.league,
  date: prev.date || it.date || new Date(now()).toISOString(),
  savedAt: prev.savedAt || now(),
})

const articleRecord = (a, prev, now) => ({
  ...prev,
  slug: a.slug,
  id: a.id ?? prev.id,
  title: filled(a.title) ?? prev.title,
  subtitle: filled(a.excerpt) ?? prev.subtitle ?? '',
  excerpt: filled(a.excerpt) ?? prev.excerpt,
  image: filled(a.image) ?? prev.image,
  league: filled(a.league) ?? prev.league,
  author: filled(a.author) ?? prev.author,
  blocks: filled(a.blocks) ?? prev.blocks,
  sourceUrl: filled(a.sourceUrl) ?? prev.sourceUrl,
  date: a.date || prev.date || new Date(now()).toISOString(),
  savedAt: prev.savedAt || now(),
})

const archivedArticle = (a, nowMs) => ({
  id: a.id,
  slug: a.slug,
  title: a.title,
  excerpt: a.excerpt || a.subtitle || '',
  image: a.image,
  author: a.author || 'SofaScore',
  league: a.league || 'Futbol',
  date: a.date,
  time: relTime(a.date, nowMs),
  blocks: a.blocks,
  sourceUrl: a.sourceUrl,
  fromArchive: true,
})

/**
 * Mustaqil arxiv nusxasi (testlar vaqtinchalik papka bilan ishlatadi).
 * @param {{ file: string, debounceMs?: number, maxItems?: number, logger?: Pick<Console, 'warn' | 'error'>,
 *   now?: () => number, fs?: typeof nodeFs, platform?: string }} opts
 */
export function createArchive({
  file,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  maxItems = DEFAULT_MAX_ITEMS,
  logger = console,
  now = Date.now,
  fs = nodeFs,
  platform = process.platform,
}) {
  const { entries, writable } = readArchive(fs, file, logger)
  const writer = createWriter({ fs, platform, file, entries, debounceMs, logger, writable })

  // Yozuvni almashtiradi; haqiqatan o'zgargan bo'lsa true
  function put(slug, build) {
    const prev = entries.get(slug)
    const next = build(prev || {})
    if (prev && sameRecord(prev, next)) return false
    entries.set(slug, next)
    return true
  }

  function commit(changed) {
    if (!changed) return
    evictOldest(entries, maxItems)
    writer.markDirty()
  }

  return {
    // Lenta kartalarini saqlaymiz (yengil — matnsiz)
    saveCards(items = []) {
      let changed = false
      for (const it of Array.isArray(items) ? items : []) {
        if (typeof it?.slug !== 'string' || !it.slug) continue
        changed = put(it.slug, prev => cardRecord(it, prev, now)) || changed
      }
      commit(changed)
    },
    // To'liq maqolani saqlaymiz (bloklar bilan). Tarjimasi chala maqola saqlanmaydi.
    saveArticle(a) {
      if (typeof a?.slug !== 'string' || !a.slug || a.translationComplete === false) return false
      commit(put(a.slug, prev => articleRecord(a, prev, now)))
      return true
    },
    // To'liq maqola (arxivdan) — SofaScore'da yo'q bo'lsa zaxira sifatida
    getArticle(slug) {
      const a = entries.get(slug)
      return a && a.blocks ? archivedArticle(a, now()) : null
    },
    list(opts) {
      return listEntries([...entries.values()], opts, now())
    },
    count: () => entries.size,
    flush: () => writer.flush(),
    isDirty: () => writer.isDirty(),
  }
}

function categoryCounts(all) {
  const counts = new Map()
  for (const a of all) {
    const k = a.league || 'Futbol'
    counts.set(k, (counts.get(k) || 0) + 1)
  }
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
}

// Arxiv ro'yxati — qidiruv + kategoriya + sahifalash (page 0 dan, size 1..50)
function listEntries(all, { q = '', category = '', page = 0, size = DEFAULT_PAGE_SIZE } = {}, nowMs) {
  const p = clampInt(page, 0, MAX_PAGE, 0)
  const s = clampInt(size, 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE)
  const c = typeof category === 'string' ? category.toLowerCase() : ''
  const t = typeof q === 'string' ? q.slice(0, MAX_QUERY_LENGTH).toLowerCase() : ''
  const arr = all
    .filter(a => !c || (a.league || '').toLowerCase() === c)
    .filter(a => !t || `${a.title || ''} ${a.subtitle || ''} ${blocksText(a)}`.toLowerCase().includes(t))
    .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
  const total = arr.length
  const items = arr.slice(p * s, p * s + s).map(a => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    subtitle: a.subtitle || a.excerpt || '',
    image: a.image,
    league: a.league,
    time: relTime(a.date, nowMs),
    hasFull: !!a.blocks,
  }))
  return { items, total, page: p, size: s, hasMore: (p + 1) * s < total, categories: categoryCounts(all) }
}

// Standart nusxa birinchi chaqiruvda yaratiladi (import paytida faylga tegmaydi).
// Papka: ESCORE_DATA_DIR env yoki server/db.
let defaultArchive = null
function instance() {
  defaultArchive ??= createArchive({ file: join(process.env.ESCORE_DATA_DIR || DEFAULT_DATA_DIR, FILE_NAME) })
  return defaultArchive
}

export const saveCards = items => instance().saveCards(items)
export const saveArticle = a => instance().saveArticle(a)
export const getArticle = slug => instance().getArticle(slug)
export const list = opts => instance().list(opts)
export const count = () => instance().count()
/** Kutilayotgan yozuvlarni darhol diskka yozadi (SIGTERM uchun). */
export const flush = () => (defaultArchive ? defaultArchive.flush() : Promise.resolve())
