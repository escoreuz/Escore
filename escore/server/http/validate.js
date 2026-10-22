// So'rov parametrlarini tekshirish (FIX-PLAN 2.3). Yaroqsiz qiymat → HttpError 400.
import { NotFoundError } from '../errors.js'
import { badRequest } from './errors.js'

export const REAL_ID = /^\d{1,10}$/
export const DEMO_ID = /^[a-z0-9-]{1,40}$/i
export const SLUG_RE = /^[a-z0-9-]{1,160}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const PAGE_RE = /^\d{1,5}$/
const MAX_QUERY_LENGTH = 80
const MAX_ARCHIVE_PAGE = 10000

function isRealDate(value) {
  if (!DATE_RE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

/** Ixtiyoriy matn (q, category): yo'q → '', massiv yoki uzun → 400. */
export function optText(value, name, max = MAX_QUERY_LENGTH) {
  if (value === undefined) return ''
  if (typeof value !== 'string' || value.length > max) throw badRequest(`${name} ${max} belgigacha matn bo'lsin`)
  return value.trim()
}

/** Ixtiyoriy sana: yo'q → fallback(), aks holda haqiqiy YYYY-MM-DD. */
export function optDate(value, fallback) {
  if (value === undefined || value === '') return fallback()
  if (typeof value !== 'string' || !isRealDate(value)) throw badRequest("date YYYY-MM-DD ko'rinishida bo'lsin")
  return value
}

export function optPage(value) {
  if (value === undefined || value === '') return 0
  const n = typeof value === 'string' && PAGE_RE.test(value) ? Number(value) : NaN
  if (!(n <= MAX_ARCHIVE_PAGE)) throw badRequest(`page 0..${MAX_ARCHIVE_PAGE} oralig'ida bo'lsin`)
  return n
}

export function slugParam(value) {
  if (typeof value !== 'string' || !SLUG_RE.test(value)) throw badRequest('Yaroqsiz slug')
  return value
}

export function oneOf(set, value, name) {
  if (typeof value !== 'string' || !set.has(value)) throw badRequest(`Noma'lum ${name}`)
  return value
}

/** Rejimga mos ID tekshiruvchisi (REAL — raqam, DEMO — slug). */
export const idValidator =
  re =>
  (value, name = 'id') => {
    if (typeof value !== 'string' || !re.test(value)) throw badRequest(`${name} yaroqsiz`)
    return value
  }

/** Faqat http(s) URL qaytaradi, aks holda null. */
export function safeHttpUrl(value) {
  if (typeof value !== 'string' || !value) return null
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null // URL emas — xavfsiz qiymat sifatida null
  }
}

export const publicArticle = a => ({
  ...a,
  sourceUrl: safeHttpUrl(a.sourceUrl),
  translationComplete: a.translationComplete !== false,
})

/** null/undefined → NotFoundError (404). */
export function required(value, what) {
  if (value === null || value === undefined) throw new NotFoundError(`${what} topilmadi`)
  return value
}
