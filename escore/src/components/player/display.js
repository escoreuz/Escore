// O'yinchi/murabbiy/hakam sahifalari uchun ko'rsatish yordamchilari (sof funksiyalar, UI'dan mustaqil)

export const MISSING = '—'

/** Server bermagan qiymat (null/undefined/bo'sh satr) → "—". Uydirma nol qo'yilmaydi. */
export const dash = v => (v == null || v === '' ? MISSING : v)

/** `meta.unavailable` ro'yxatida bo'lim nomi bormi (manba javob bermagan bo'lim). */
export const isUnavailable = (meta, name) => Array.isArray(meta?.unavailable) && meta.unavailable.includes(name)

/** 'YYYY-MM-DD' → 'DD.MM'; noto'g'ri qiymatda bo'sh satr. */
export function shortDate(d) {
  return typeof d === 'string' && d.length >= 10 ? `${d.slice(8, 10)}.${d.slice(5, 7)}` : ''
}

/**
 * Reyting qiymatini songa aylantiradi: '7.12' → 7.12; null, '—', 'abc' → null.
 * @param {unknown} r
 * @returns {number|null}
 */
export function ratingValue(r) {
  if (r == null || r === '' || r === MISSING) return null
  const n = typeof r === 'number' ? r : Number(r)
  return Number.isFinite(n) ? n : null
}

/** Reyting matni: son bo'lmasa "—". */
export const ratingText = r => (ratingValue(r) == null ? MISSING : String(r))

// Reyting oraliqlari va fon ranglari. Barcha fonlar oq matn bilan WCAG AA (≥ 4.5:1) kontrastga ega —
// testda lib/color.js contrastRatio bilan tekshiriladi. Eski ranglar (#e08a1e 2.68, #cdaa2e 2.24,
// #2e8b57 4.25) o'tmagani uchun to'qroq tuslarga almashtirildi.
export const RATING_BANDS = Object.freeze([
  { below: 6, bg: '#a32020' },
  { below: 6.5, bg: '#a04a00' },
  { below: 7, bg: '#7a6000' },
  { below: Infinity, bg: '#1d6b3f' },
])
export const RATING_TEXT_COLOR = '#ffffff'

/** Reyting foni; reyting yo'q bo'lsa null. */
export function ratingColor(r) {
  const n = ratingValue(r)
  if (n == null) return null
  return RATING_BANDS.find(b => n < b.below).bg
}

/** Reyting nishoni uchun inline uslub (fon + oq matn); reyting yo'q bo'lsa undefined (CSS standarti). */
export function ratingStyle(r) {
  const bg = ratingColor(r)
  return bg ? { background: bg, color: RATING_TEXT_COLOR } : undefined
}
