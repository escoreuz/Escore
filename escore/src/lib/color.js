// Rang kontrasti yordamchilari (WCAG 2.x nisbiy yorqinlik). Jamoa rangi inline fon bo'lganda
// matn rangini tanlash uchun: qora yoki oqdan biri istalgan fonda kamida ~4.58:1 beradi (AA ≥ 4.5:1).

export const DARK_TEXT = '#000000'
export const LIGHT_TEXT = '#ffffff'

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i
// WCAG 2.x formulasidagi doimiylar
const LINEAR_THRESHOLD = 0.03928
const CONTRAST_OFFSET = 0.05
const LUMA = [0.2126, 0.7152, 0.0722]

function toLinear(channel) {
  const s = channel / 255
  return s <= LINEAR_THRESHOLD ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

/**
 * `#rgb` yoki `#rrggbb` rangning nisbiy yorqinligi (0..1). Tanilmagan qiymat → null.
 * @param {unknown} color
 * @returns {number|null}
 */
export function relativeLuminance(color) {
  if (typeof color !== 'string') return null
  const match = HEX_RE.exec(color.trim())
  if (!match) return null
  const hex = match[1].length === 3 ? Array.from(match[1], ch => ch + ch).join('') : match[1]
  return [0, 2, 4].reduce((sum, i, k) => sum + LUMA[k] * toLinear(parseInt(hex.slice(i, i + 2), 16)), 0)
}

/**
 * Ikki rang orasidagi kontrast nisbati (1..21). Biri yaroqsiz bo'lsa null.
 * @param {unknown} a
 * @param {unknown} b
 * @returns {number|null}
 */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  if (la === null || lb === null) return null
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + CONTRAST_OFFSET) / (lo + CONTRAST_OFFSET)
}

/**
 * Fon rangiga eng yuqori kontrast beradigan matn rangi (qora yoki oq). Tanilmagan fon → null.
 * @param {unknown} bg
 * @returns {string|null}
 */
export function readableTextColor(bg) {
  if (relativeLuminance(bg) === null) return null
  return contrastRatio(bg, DARK_TEXT) >= contrastRatio(bg, LIGHT_TEXT) ? DARK_TEXT : LIGHT_TEXT
}
