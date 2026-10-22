import { describe, it, expect } from 'vitest'
import { contrastRatio, relativeLuminance } from '../../lib/color.js'
import {
  RATING_BANDS,
  dash,
  isUnavailable,
  ratingColor,
  ratingStyle,
  ratingText,
  ratingValue,
  shortDate,
} from './display.js'

const WHITE = '#ffffff'
const WCAG_AA = 4.5

describe('lib/color.js kontrast funksiyasi (mos yozuv qiymatlari)', () => {
  it("ma'lum mos yozuv qiymatlari: oq/qora 21, #777/oq ≈ 4.48, simmetrik", () => {
    expect(relativeLuminance('#000000')).toBe(0)
    expect(relativeLuminance(WHITE)).toBeCloseTo(1, 10)
    expect(contrastRatio(WHITE, '#000000')).toBeCloseTo(21, 5)
    expect(contrastRatio('#777777', WHITE)).toBeCloseTo(4.48, 2)
    expect(contrastRatio(WHITE, '#777777')).toBeCloseTo(contrastRatio('#777777', WHITE), 10)
  })

  it("eski reyting ranglari oq matn bilan AA dan o'tmasdi (regressiya sababi)", () => {
    for (const old of ['#e08a1e', '#cdaa2e', '#2e8b57']) expect(contrastRatio(old, WHITE)).toBeLessThan(WCAG_AA)
  })
})

describe('ratingColor / ratingStyle', () => {
  it('har oraliq foni oq matn bilan ≥ 4.5:1 kontrastga ega', () => {
    for (const band of RATING_BANDS) expect(contrastRatio(band.bg, WHITE)).toBeGreaterThanOrEqual(WCAG_AA)
    for (const r of [0, 5.99, 6, 6.49, 6.5, 6.99, 7, 10, '7.12', '5.4']) {
      const style = ratingStyle(r)
      expect(style.color).toBe(WHITE)
      expect(contrastRatio(style.background, style.color)).toBeGreaterThanOrEqual(WCAG_AA)
    }
  })

  it('chegaraviy qiymatlar keyingi oraliqqa tushadi', () => {
    expect(ratingColor(5.99)).toBe(RATING_BANDS[0].bg)
    expect(ratingColor(6)).toBe(RATING_BANDS[1].bg)
    expect(ratingColor(6.5)).toBe(RATING_BANDS[2].bg)
    expect(ratingColor('7.0')).toBe(RATING_BANDS[3].bg)
  })

  it("reyting yo'q bo'lsa rang yo'q va matn \"—\"", () => {
    for (const r of [null, undefined, '', '—', 'abc', NaN]) {
      expect(ratingValue(r)).toBeNull()
      expect(ratingColor(r)).toBeNull()
      expect(ratingStyle(r)).toBeUndefined()
      expect(ratingText(r)).toBe('—')
    }
    expect(ratingText('6.80')).toBe('6.80')
  })
})

describe('dash / isUnavailable / shortDate', () => {
  it('null → "—", lekin 0 saqlanadi (uydirma ham, yo\'qotish ham yo\'q)', () => {
    expect(dash(null)).toBe('—')
    expect(dash(undefined)).toBe('—')
    expect(dash('')).toBe('—')
    expect(dash(0)).toBe(0)
    expect(dash('4-3-3')).toBe('4-3-3')
  })

  it("meta.unavailable bo'lim nomini tekshiradi; meta bo'lmasa false", () => {
    expect(isUnavailable({ unavailable: ['matches'] }, 'matches')).toBe(true)
    expect(isUnavailable({ unavailable: ['matches'] }, 'attrs')).toBe(false)
    expect(isUnavailable(undefined, 'matches')).toBe(false)
    expect(isUnavailable({ unavailable: 'matches' }, 'matches')).toBe(false)
  })

  it("shortDate: 'YYYY-MM-DD' → 'DD.MM', yaroqsiz → bo'sh", () => {
    expect(shortDate('2026-10-05')).toBe('05.10')
    expect(shortDate(null)).toBe('')
    expect(shortDate('2026')).toBe('')
  })
})
