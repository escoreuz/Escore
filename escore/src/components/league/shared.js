// League/Team/Match sahifalari uchun umumiy sof yordamchilar: null → "—", bo'lim holati.

export const DASH = '—'
export const UNAVAILABLE_TEXT = "Ma'lumot manbai vaqtincha ishlamayapti"

/** null/undefined/bo'sh satr/NaN → "—" (uydirma qiymat to'ldirilmaydi). */
export const dash = v => (v == null || v === '' || Number.isNaN(v) ? DASH : v)

/** Qiymat ma'lummi (server ilgari "—" sentinel qaytarardi, endi null — ikkalasi ham "noma'lum"). */
export const isKnown = v => v != null && v !== '' && v !== DASH

/**
 * Server `meta.unavailable` ro'yxatida berilgan bo'limlardan biri bormi.
 * @param {{ unavailable?: string[] } | undefined} meta
 * @param {string[]} parts
 */
export function isUnavailable(meta, parts) {
  const list = Array.isArray(meta?.unavailable) ? meta.unavailable : []
  return parts.some(p => list.includes(p))
}
