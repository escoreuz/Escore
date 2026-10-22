import { describe, it, expect } from 'vitest'
import { safeUrl, initials, fmtTashkentDate, tashkentDateKey } from './format.js'

describe('safeUrl', () => {
  it('http va https havolalarni normallashtirib qaytaradi', () => {
    expect(safeUrl('https://www.sofascore.com/news/1')).toBe('https://www.sofascore.com/news/1')
    expect(safeUrl('  http://example.com ')).toBe('http://example.com/')
  })

  it('xavfli sxemalarni rad etadi', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl('JaVaScRiPt:alert(1)')).toBeNull()
    expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(safeUrl('vbscript:msgbox(1)')).toBeNull()
    expect(safeUrl('ftp://example.com/file')).toBeNull()
  })

  it('nisbiy, bo`sh va satr bo`lmagan qiymatlarni rad etadi', () => {
    expect(safeUrl('/news/abc')).toBeNull()
    expect(safeUrl('//evil.com/x')).toBeNull()
    expect(safeUrl('example.com')).toBeNull()
    expect(safeUrl('')).toBeNull()
    expect(safeUrl('   ')).toBeNull()
    expect(safeUrl(null)).toBeNull()
    expect(safeUrl(undefined)).toBeNull()
    expect(safeUrl(42)).toBeNull()
  })
})

describe('initials', () => {
  it('ko`p so`zli nomdan ikki bosh harf', () => {
    expect(initials('Real Madrid')).toBe('RM')
    expect(initials('  manchester   united city ')).toBe('MU')
  })

  it('bitta so`zdan dastlabki uch belgi', () => {
    expect(initials('Barcelona')).toBe('BAR')
    expect(initials('PSG')).toBe('PSG')
    expect(initials('Al')).toBe('AL')
  })

  it('bo`sh yoki noto`g`ri kirishda bo`sh satr', () => {
    expect(initials('')).toBe('')
    expect(initials('   ')).toBe('')
    expect(initials(null)).toBe('')
    expect(initials(undefined)).toBe('')
    expect(initials(123)).toBe('')
  })

  it('harf/raqam bo`lmagan belgilar ajratuvchi: defis, apostrof, nuqta', () => {
    expect(initials('Al-Hilal')).toBe('AH')
    expect(initials("O'zbekiston")).toBe('OZ')
    expect(initials('A.C. Milan')).toBe('AC')
    expect(initials('1860 München')).toBe('1M')
    expect(initials('Ölgii')).toBe('ÖLG')
  })

  it('emoji (bayroq ham) yarmi initsialga tushmaydi', () => {
    expect(initials('🇺🇿 Uzbekistan')).toBe('UZB')
    expect(initials('😀ab')).toBe('AB')
    expect(initials('🇺🇿')).toBe('')
    expect(initials('---')).toBe('')
  })
})

describe('fmtTashkentDate', () => {
  // 2026-10-15T20:30:00Z = Toshkentda 16-oktabr, 01:30 (UTC+5) — kun almashinuvi chegarasi
  const lateUtc = '2026-10-15T20:30:00Z'

  it('Toshkent mintaqasida kunni hisoblaydi (UTC dan farqli)', () => {
    expect(fmtTashkentDate(lateUtc)).toBe('16-oktabr 2026')
  })

  it('hafta kuni va vaqt opsiyalari', () => {
    expect(fmtTashkentDate(lateUtc, { weekday: true, time: true })).toBe('Juma, 16-oktabr 2026, 01:30')
    expect(fmtTashkentDate(new Date('2026-01-05T07:05:00Z'), { year: false, time: true })).toBe('5-yanvar, 12:05')
  })

  it('yaroqsiz sanada bo`sh satr', () => {
    expect(fmtTashkentDate('not-a-date')).toBe('')
    expect(fmtTashkentDate(null)).toBe('')
    expect(fmtTashkentDate(undefined)).toBe('')
    expect(fmtTashkentDate('')).toBe('')
  })
})

describe('tashkentDateKey', () => {
  it('YYYY-MM-DD ni Toshkent vaqtida qaytaradi', () => {
    expect(tashkentDateKey('2026-10-15T18:59:59Z')).toBe('2026-10-15')
    expect(tashkentDateKey('2026-10-15T19:00:00Z')).toBe('2026-10-16')
    expect(tashkentDateKey(Date.UTC(2026, 11, 31, 19, 0))).toBe('2027-01-01')
  })

  it('yaroqsiz sanada bo`sh satr', () => {
    expect(tashkentDateKey('xyz')).toBe('')
  })
})
