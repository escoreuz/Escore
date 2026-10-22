import { describe, it, expect } from 'vitest'
import {
  describeChanges,
  groupByLeague,
  hasScore,
  IDLE_POLL_MS,
  LIVE_POLL_MS,
  pickFeatured,
  pollInterval,
  scoreText,
  statusLabel,
  statusWord,
} from './matchText.js'

const team = n => ({ n, c: '#123456', id: 1 })
const match = (id, extra = {}) => ({
  id,
  status: 'sched',
  hs: null,
  as: null,
  minute: null,
  time: '20:00',
  home: team('Arsenal'),
  away: team('Chelsea'),
  leagueId: 17,
  league: { id: 17, name: 'Premier League', country: 'Angliya' },
  ...extra,
})

describe('pickFeatured', () => {
  it("birinchi jonli o'yinni qaytaradi", () => {
    const list = [match(1, { status: 'ft' }), match(2, { status: 'live' }), match(3, { status: 'live' })]
    expect(pickFeatured(list).id).toBe(2)
  })
  it("jonli o'yin bo'lmasa null (uydirma yo'q)", () => {
    expect(pickFeatured([match(1), match(2, { status: 'ft' })])).toBeNull()
    expect(pickFeatured(null)).toBeNull()
  })
})

describe('statusLabel / scoreText', () => {
  it('jonli → daqiqa, bekor/qoldirilgan/to‘xtatilgan → yorliq', () => {
    expect(statusLabel(match(1, { status: 'live', minute: 67 }))).toBe("67'")
    expect(statusLabel(match(1, { status: 'canceled' }))).toBe('Bekor qilindi')
    expect(statusLabel(match(1, { status: 'postponed' }))).toBe('Qoldirildi')
    expect(statusLabel(match(1, { status: 'interrupted' }))).toBe("To'xtatildi")
    expect(statusLabel(match(1, { status: 'ft' }))).toBe('FT')
  })
  it("rejadagi o'yinda vaqt, vaqt ham yo'q bo'lsa —", () => {
    expect(statusLabel(match(1))).toBe('20:00')
    expect(statusLabel(match(1, { time: null, status: null }))).toBe('—')
    expect(statusWord(match(1, { status: null }))).toBe('—')
  })
  it("hisob null bo'lsa 'null' yoki 0 chiqmaydi", () => {
    expect(hasScore(match(1))).toBe(false)
    expect(scoreText(match(1))).toBe('Arsenal – Chelsea')
    expect(scoreText(match(1, { hs: 2, as: 1 }))).toBe('Arsenal 2 – 1 Chelsea')
    expect(scoreText(match(1, { home: { n: null }, away: null }))).toBe('— – —')
  })
})

describe('groupByLeague', () => {
  it("liga bo'yicha guruhlaydi, leagueId null bo'lsa nom bo'yicha", () => {
    const groups = groupByLeague([
      match(1),
      match(2, { leagueId: null, league: { id: null, name: 'X', country: 'Y' } }),
      match(3),
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0].list.map(m => m.id)).toEqual([1, 3])
    expect(groups[1].leagueId).toBeNull()
  })
})

describe('describeChanges', () => {
  it("birinchi yuklanishda e'lon yo'q", () => {
    expect(describeChanges(null, [match(1)])).toBe('')
  })
  it('gol va yakunni e’lon qiladi, o‘zgarmaganni emas', () => {
    const prev = [match(1, { status: 'live', hs: 1, as: 1 }), match(2, { status: 'live', hs: 0, as: 0 }), match(3)]
    const next = [match(1, { status: 'live', hs: 2, as: 1 }), match(2, { status: 'ft', hs: 0, as: 0 }), match(3)]
    expect(describeChanges(prev, next)).toBe("Hisob o'zgardi: Arsenal 2 – 1 Chelsea. Tugadi: Arsenal 0 – 0 Chelsea")
    expect(describeChanges(next, next)).toBe('')
  })
  it("rejadagi o'yin 0-0 bilan boshlanganda yolg'on gol e'lon qilinmaydi", () => {
    const prev = [match(1)]
    const next = [match(1, { status: 'live', hs: 0, as: 0, minute: 1 })]
    expect(describeChanges(prev, next)).toBe('')
  })
})

describe('pollInterval', () => {
  it("jonli bo'lsa 15 s, bo'lmasa 60 s", () => {
    expect(pollInterval(2)).toBe(LIVE_POLL_MS)
    expect(pollInterval(0)).toBe(IDLE_POLL_MS)
  })
})
