// Yangiliklar ombori — tahririyat maqolalari JSON faylda saqlanadi (CRUD).
// Fayl yo'q bo'lsa seed (server/demo/news.js) bilan yaratiladi; buzilgan bo'lsa
// `.corrupt-<ts>` nusxaga ko'chirilib, seed'dan tiklanadi. Yozish atomik: tmp + rename.
// Har o'zgarish avval yangi massivda tayyorlanadi, faylga yozilgach xotiraga o'tadi
// (yozish yiqilsa xotiradagi holat o'zgarmaydi).
import * as nodeFs from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_DATA_DIR = join(__dirname, 'db')
const FILE_NAME = 'news.json'
const SEED_URL = new URL('./demo/news.js', import.meta.url)
// Windows: antivirus/indekser faylni qisqa vaqt band qilsa rename EPERM/EBUSY/EACCES beradi
const RENAME_RETRY_DELAYS_MS = [50, 100, 200]
const RETRYABLE_RENAME_CODES = new Set(['EPERM', 'EBUSY', 'EACCES'])

// ---- Validatsiya chegaralari ----
const LIMITS = {
  title: 200,
  longText: 600, // standfirst, excerpt
  shortText: 80, // kicker, section, author, photoTag
  caption: 300,
  date: 40,
  readTime: 40,
  bodyItems: 60,
  bodyItemLength: 6000,
  tags: 10,
  tagLength: 40,
  image: 2000,
  slug: 80,
}
const TEXT_FIELDS = {
  title: LIMITS.title,
  standfirst: LIMITS.longText,
  excerpt: LIMITS.longText,
  kicker: LIMITS.shortText,
  section: LIMITS.shortText,
  author: LIMITS.shortText,
  photoTag: LIMITS.shortText,
  caption: LIMITS.caption,
  date: LIMITS.date,
  readTime: LIMITS.readTime,
}
const ALLOWED_FIELDS = new Set([...Object.keys(TEXT_FIELDS), 'body', 'image', 'tags'])
const DEFAULT_SECTION = 'YANGILIK'
const DEFAULT_AUTHOR = 'eSCORE'
const DEFAULT_READ_TIME = "3 daqiqa o'qish"
const DEFAULT_PHOTO_TAG = 'FOTO · eSCORE'

/** Validatsiya xatosi (index.js uni 400 ga xaritalaydi). */
export class ArticleValidationError extends Error {
  constructor(errors) {
    super(errors.join('; '))
    this.name = 'ArticleValidationError'
    this.status = 400
    this.code = 'BAD_REQUEST'
    this.errors = errors
  }
}

const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v)

function checkText(name, raw, max, errors) {
  if (typeof raw !== 'string') return void errors.push(`${name} matn bo'lishi kerak`)
  const v = raw.trim()
  if (v.length > max) return void errors.push(`${name} ${max} belgidan oshmasin`)
  return v
}

function checkStringList(name, raw, maxItems, maxLength, errors) {
  if (!Array.isArray(raw)) return void errors.push(`${name} matnlar massivi bo'lishi kerak`)
  if (raw.length > maxItems) return void errors.push(`${name} ${maxItems} tadan oshmasin`)
  const out = []
  for (const [i, item] of raw.entries()) {
    if (typeof item !== 'string') return void errors.push(`${name}[${i}] matn bo'lishi kerak`)
    if (item.length > maxLength) return void errors.push(`${name}[${i}] ${maxLength} belgidan oshmasin`)
    const v = item.trim()
    if (v) out.push(v)
  }
  return out
}

function checkImage(raw, errors) {
  if (typeof raw !== 'string') return void errors.push("image matn bo'lishi kerak")
  const v = raw.trim()
  if (!v) return ''
  if (v.length > LIMITS.image) return void errors.push(`image ${LIMITS.image} belgidan oshmasin`)
  try {
    const u = new URL(v)
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.href
  } catch {
    // URL emas — pastdagi umumiy xato qaytadi
  }
  errors.push("image faqat http(s) URL yoki bo'sh bo'lishi mumkin")
}

/**
 * Maqola kiritmasini oq ro'yxat bo'yicha tekshiradi.
 * @param {unknown} input
 * @param {{ partial?: boolean }} [opts] partial=true — yangilash (majburiy maydon yo'q)
 * @returns {{ ok: true, value: object } | { ok: false, errors: string[] }}
 */
export function validateArticle(input, { partial = false } = {}) {
  if (!isPlainObject(input)) return { ok: false, errors: ["Maqola obyekt bo'lishi kerak"] }
  const errors = []
  const value = {}
  for (const key of Object.keys(input)) {
    if (!ALLOWED_FIELDS.has(key)) errors.push(`Ruxsat etilmagan maydon: ${key.slice(0, 40)}`)
  }
  for (const [name, max] of Object.entries(TEXT_FIELDS)) {
    if (input[name] === undefined) continue
    const v = checkText(name, input[name], max, errors)
    if (v !== undefined) value[name] = v
  }
  if (input.body !== undefined) {
    const v = checkStringList('body', input.body, LIMITS.bodyItems, LIMITS.bodyItemLength, errors)
    if (v) value.body = v
  }
  if (input.tags !== undefined) {
    const v = checkStringList('tags', input.tags, LIMITS.tags, LIMITS.tagLength, errors)
    if (v) value.tags = v
  }
  if (input.image !== undefined) {
    const v = checkImage(input.image, errors)
    if (v !== undefined) value.image = v
  }
  const titleMissing = partial ? 'title' in value && !value.title : !value.title
  if (titleMissing && !errors.some(e => e.startsWith('title'))) errors.push('title majburiy')
  return errors.length ? { ok: false, errors } : { ok: true, value }
}

// ---- Slug (serverda yaratiladi) ----
function slugify(title) {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ʻʼ'`‘’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LIMITS.slug)
    .replace(/-+$/g, '')
  return base || 'maqola'
}

function uniqueSlug(title, articles) {
  const taken = new Set(articles.map(a => a.slug))
  const base = slugify(title)
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`
    if (!taken.has(candidate)) return candidate
  }
}

// ---- Matn yordamchilari (buzilgan ma'lumotga chidamli) ----
function asText(v) {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.filter(x => typeof x === 'string').join(' ')
  return ''
}
const withoutBody = a => {
  const rest = { ...a }
  delete rest.body
  return rest
}
const isArticleRecord = a => isPlainObject(a) && typeof a.slug === 'string' && a.slug.length > 0

// ---- Fayl qatlami (io = { fs, platform, logger } — testlarda inyeksiya qilinadi) ----
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

// Faqat win32 da vaqtinchalik band-xatolarda 3 marta qayta urinadi (50/100/200 ms).
// Sinxron kutish event loop'ni ≤ 350 ms to'xtatadi — faqat kam uchraydigan admin yozuvida.
export function renameWithRetrySync(fs, from, to, platform = process.platform) {
  for (let attempt = 0; ; attempt++) {
    try {
      return fs.renameSync(from, to)
    } catch (err) {
      const retryable = platform === 'win32' && RETRYABLE_RENAME_CODES.has(err.code)
      if (!retryable || attempt >= RENAME_RETRY_DELAYS_MS.length) throw err
      sleepSync(RENAME_RETRY_DELAYS_MS[attempt])
    }
  }
}

function writeAtomic(io, file, data) {
  const { fs, platform, logger } = io
  fs.mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.tmp-${process.pid}`
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
    renameWithRetrySync(fs, tmp, file, platform)
  } catch (err) {
    logger.error(`[store] ${file} ga yozib bo'lmadi (${err.code || err.message}); tmp fayl o'chiriladi`)
    try {
      fs.rmSync(tmp, { force: true })
    } catch (rmErr) {
      logger.error(`[store] tmp faylni o'chirib bo'lmadi: ${rmErr.message}`)
    }
    throw err
  }
}

function quarantine(io, file, reason) {
  const target = `${file}.corrupt-${Date.now()}`
  renameWithRetrySync(io.fs, file, target, io.platform)
  io.logger.error(`[store] ${file} buzilgan (${reason}); ${target} ga ko'chirildi, seed'dan tiklanadi`)
}

function readArticles(io, file, seed) {
  let raw
  try {
    raw = io.fs.readFileSync(file, 'utf8')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err // ruxsat va h.k. — ustidan yozib yubormaymiz
    writeAtomic(io, file, seed)
    return structuredClone(seed)
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    quarantine(io, file, `JSON xatosi: ${err.message}`)
  }
  if (parsed !== undefined && !Array.isArray(parsed)) quarantine(io, file, 'massiv emas')
  if (!Array.isArray(parsed)) {
    writeAtomic(io, file, seed)
    return structuredClone(seed)
  }
  const valid = parsed.filter(isArticleRecord)
  if (valid.length !== parsed.length) {
    io.logger.warn(`[store] ${parsed.length - valid.length} ta yaroqsiz yozuv (slug yo'q) e'tiborsiz qoldirildi`)
  }
  return valid
}

function validated(data, partial) {
  const res = validateArticle(data, { partial })
  if (!res.ok) throw new ArticleValidationError(res.errors)
  return res.value
}

// Validatsiyadan o'tgan qiymatdan yangi maqola (slug serverda, standart qiymatlar bilan)
function buildArticle(v, existing) {
  const section = v.section || DEFAULT_SECTION
  return {
    slug: uniqueSlug(v.title, existing),
    section,
    kicker: v.kicker || section,
    title: v.title,
    standfirst: v.standfirst ?? v.excerpt ?? '',
    author: v.author || DEFAULT_AUTHOR,
    date: v.date || new Date().toISOString().slice(0, 10),
    readTime: v.readTime || DEFAULT_READ_TIME,
    photoTag: v.photoTag || DEFAULT_PHOTO_TAG,
    caption: v.caption ?? '',
    image: v.image ?? '',
    tags: v.tags ?? [],
    body: v.body ?? [],
  }
}

/**
 * Mustaqil ombor nusxasi (testlar vaqtinchalik papka bilan ishlatadi).
 * Qaytariladigan obyektlar ichki holatning nusxasi (tashqaridan o'zgartirib bo'lmaydi).
 * @param {{ file: string, seed?: object[], logger?: Pick<Console, 'warn' | 'error'>, fs?: typeof nodeFs,
 *   platform?: string }} opts
 */
export function createStore({ file, seed = [], logger = console, fs = nodeFs, platform = process.platform }) {
  const io = { fs, platform, logger }
  let articles = readArticles(io, file, seed)

  // Tranzaksiya: yangi holat faylga yozilgandan keyingina xotiraga o'tadi
  function commit(next) {
    writeAtomic(io, file, next)
    articles = next
  }

  return {
    listArticles: () => structuredClone(articles.map(withoutBody)),
    getArticle(slug) {
      const found = articles.find(a => a.slug === slug)
      return found ? structuredClone(found) : null
    },
    createArticle(data) {
      const article = buildArticle(validated(data, false), articles)
      commit([article, ...articles])
      return structuredClone(article)
    },
    updateArticle(slug, data) {
      const v = validated(data, true)
      const i = articles.findIndex(a => a.slug === slug)
      if (i === -1) return null
      const updated = { ...articles[i], ...v, slug }
      commit(articles.map((a, j) => (j === i ? updated : a)))
      return structuredClone(updated)
    },
    deleteArticle(slug) {
      if (!articles.some(a => a.slug === slug)) return false
      commit(articles.filter(a => a.slug !== slug))
      return true
    },
    searchArticles(q) {
      const term = typeof q === 'string' ? q.trim().toLowerCase() : ''
      if (!term) return []
      const found = articles.filter(a =>
        [a.title, a.standfirst, a.section, a.body].map(asText).join(' ').toLowerCase().includes(term),
      )
      return structuredClone(found.map(withoutBody))
    },
    // Bosh sahifa bloklari (lead/secondary/columns) joriy ombordan
    homeBlocks: () =>
      structuredClone({ lead: articles[0], secondary: articles.slice(1, 4), columns: articles.slice(4, 7) }),
  }
}

// ---- Seed: server/demo/news.js (T-01 yaratadi). Yo'q bo'lsa — bo'sh seed + ogohlantirish ----
async function loadSeed() {
  try {
    const mod = await import(SEED_URL.href)
    return Array.isArray(mod.ARTICLES) ? mod.ARTICLES : []
  } catch (err) {
    // Faqat aynan seed fayli yo'q bo'lsa; seed ichidagi boshqa import xatosi yuqoriga uzatiladi
    const seedMissing = err.url === SEED_URL.href || String(err.message).includes(`'${fileURLToPath(SEED_URL)}'`)
    if (err.code !== 'ERR_MODULE_NOT_FOUND' || !seedMissing) throw err
    console.warn("[store] server/demo/news.js topilmadi — seed bo'sh")
    return []
  }
}
const SEED = await loadSeed()

// Standart nusxa birinchi chaqiruvda yaratiladi (import paytida faylga tegmaydi).
// Papka: ESCORE_DATA_DIR env yoki server/db.
let defaultStore = null
function instance() {
  defaultStore ??= createStore({ file: join(process.env.ESCORE_DATA_DIR || DEFAULT_DATA_DIR, FILE_NAME), seed: SEED })
  return defaultStore
}

export const listArticles = () => instance().listArticles()
export const getArticle = slug => instance().getArticle(slug)
export const createArticle = data => instance().createArticle(data)
export const updateArticle = (slug, data) => instance().updateArticle(slug, data)
export const deleteArticle = slug => instance().deleteArticle(slug)
export const searchArticles = q => instance().searchArticles(q)
export const homeBlocks = () => instance().homeBlocks()
