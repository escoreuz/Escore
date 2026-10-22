import { describe, it, expect } from 'vitest'
import { readableTextColor, contrastRatio, relativeLuminance, DARK_TEXT, LIGHT_TEXT } from './color.js'

const AA = 4.5

describe('contrastRatio', () => {
  it('oq/qora — 21:1, bir xil rang — 1:1, tartibga bog`liq emas', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5)
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#1f5130', '#1f5130')).toBe(1)
  })

  it('ma`lum qiymat: #777777 oq fonda ~4.48:1 (AA dan sal past)', () => {
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
  })

  it('yaroqsiz rangda null', () => {
    expect(contrastRatio('red', '#fff')).toBeNull()
    expect(contrastRatio('#fff', '#12345')).toBeNull()
    expect(contrastRatio(undefined, '#000')).toBeNull()
  })
})

describe('relativeLuminance', () => {
  it('#rgb va #rrggbb bir xil, # ixtiyoriy, bo`shliq kesiladi', () => {
    expect(relativeLuminance('#fff')).toBe(1)
    expect(relativeLuminance('000000')).toBe(0)
    expect(relativeLuminance(' #ABC ')).toBeCloseTo(relativeLuminance('#aabbcc'), 10)
  })
})

describe('readableTextColor', () => {
  it.each([
    ['#ffffff', DARK_TEXT],
    ['#000000', LIGHT_TEXT],
    ['#e08a1e', DARK_TEXT],
    ['#cdaa2e', DARK_TEXT],
    ['#1f5130', LIGHT_TEXT],
    ['#444', LIGHT_TEXT],
  ])('%s fonida %s tanlanadi va kontrast ≥ 4.5:1', (bg, expected) => {
    const fg = readableTextColor(bg)
    expect(fg).toBe(expected)
    expect(contrastRatio(bg, fg)).toBeGreaterThanOrEqual(AA)
  })

  it('o`rta kulrang chegarasida ham tanlangan rang AA dan o`tadi', () => {
    for (const bg of ['#757575', '#767676', '#777777', '#808080', '#959595']) {
      expect(contrastRatio(bg, readableTextColor(bg))).toBeGreaterThanOrEqual(AA)
    }
  })

  it.each([null, undefined, '', 'red', 'rgb(0,0,0)', '#ggg', '#12345', 42])('yaroqsiz %s → null', bg => {
    expect(readableTextColor(bg)).toBeNull()
  })
})
