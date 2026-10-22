// O'yin sahifasi uchun sof funksiyalar: holat matni, statistika ulushi (NaN himoyasi), ovoz foizi,
// maydon nuqtalari va JSON-LD SportsEvent.
import { matchTime } from '../../settings.js'
import { dash } from '../league/shared.js'

const PCT_MAX = 100
const PITCH_GOAL_X = 7
const PITCH_SPAN_X = 40

const STATUS_LABEL = {
  ft: 'TUGADI',
  canceled: 'BEKOR QILINDI',
  postponed: 'KECHIKTIRILDI',
  interrupted: "TO'XTATILDI",
}

const SCHEMA_STATUS = {
  canceled: 'https://schema.org/EventCancelled',
  postponed: 'https://schema.org/EventPostponed',
}
const SCHEMA_SCHEDULED = 'https://schema.org/EventScheduled'

/** Raqamga aylantiradi; yaroqsiz (NaN/Infinity/null) → null. */
export function toNumber(v) {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : null
}

/** O'yin holati yorlig'i: jonli → daqiqa, tugagan/bekor/kechiktirilgan → matn, aks holda vaqt yoki "—". */
export function heroStatus(m) {
  if (m?.status === 'live') return Number.isFinite(m.minute) ? `${m.minute}'` : 'JONLI'
  if (typeof m?.status === 'string' && Object.hasOwn(STATUS_LABEL, m.status)) return STATUS_LABEL[m.status]
  return matchTime(m) || dash(null)
}

/**
 * Statistika chizig'i ulushi (%). Qiymatlardan biri raqam bo'lmasa → null (chiziq chizilmaydi).
 * @returns {{ home: number, away: number } | null}
 */
export function statShare(home, away) {
  const h = toNumber(home)
  const a = toNumber(away)
  if (h == null || a == null || h < 0 || a < 0) return null
  const total = h + a
  if (total === 0) return { home: 0, away: 0 }
  return { home: (h / total) * PCT_MAX, away: (a / total) * PCT_MAX }
}

/** Ovoz foizlari 0..100; vote null yoki yaroqsiz qiymat bo'lsa → null (blok ko'rsatilmaydi). */
export function votePct(vote) {
  if (!vote || typeof vote !== 'object') return null
  const vals = [vote.home, vote.draw, vote.away].map(toNumber)
  if (vals.some(v => v == null)) return null
  const [home, draw, away] = vals.map(v => Math.min(PCT_MAX, Math.max(0, v)))
  return { home, draw, away }
}

/**
 * Tarkib nuqtalari: darvozabon + formatsiya chiziqlari bo'yicha x/y (%) koordinatalar.
 * @param {{ lines?: number[], players?: object[] }} lineup
 * @param {'home'|'away'} side
 */
export function pitchDots(lineup, side) {
  const players = Array.isArray(lineup?.players) ? lineup.players : []
  const lines = Array.isArray(lineup?.lines) ? lineup.lines.filter(n => Number.isInteger(n) && n > 0) : []
  const cols = [1, ...lines]
  const res = []
  let idx = 0
  cols.forEach((cnt, ci) => {
    const frac = cols.length === 1 ? 0 : ci / (cols.length - 1)
    const x = side === 'home' ? PITCH_GOAL_X + frac * PITCH_SPAN_X : PCT_MAX - PITCH_GOAL_X - frac * PITCH_SPAN_X
    for (let j = 0; j < cnt && idx < players.length; j++) {
      res.push({ ...players[idx++], x, y: ((j + 1) / (cnt + 1)) * PCT_MAX })
    }
  })
  return res
}

/** O'yin nomi: "Arsenal – Chelsea" (null nom → "—"). */
export const matchTitle = m => `${dash(m?.home?.n)} – ${dash(m?.away?.n)}`

/** schema.org SportsEvent (null maydonlar qo'shilmaydi). */
export function sportsEventJsonLd(d) {
  const m = d.match
  const team = t => (t?.n ? { '@type': 'SportsTeam', name: t.n } : undefined)
  const status = typeof m.status === 'string' && Object.hasOwn(SCHEMA_STATUS, m.status) ? SCHEMA_STATUS[m.status] : null
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: matchTitle(m),
    homeTeam: team(m.home),
    awayTeam: team(m.away),
    eventStatus: status || SCHEMA_SCHEDULED,
  }
  if (Number.isFinite(m.ts)) ld.startDate = new Date(m.ts * 1000).toISOString()
  if (d.venue) ld.location = { '@type': 'Place', name: d.venue }
  return ld
}
