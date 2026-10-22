// Sana bo'yicha o'yinlar, dominant turnir, bombardirlar va mini jadval.

import { NotFoundError, UpstreamError } from '../errors.js'
import { dateStr, shiftDate } from './dates.js'
import { isUsableEvent, mapMatch, mapScorer } from './format.js'
import { j } from './http.js'
import { logPartial } from './log.js'

const SCORERS_LIMIT = 6
const MINI_STANDINGS_LIMIT = 5

function popularity(ev) {
  return ev.tournament?.uniqueTournament?.userCount || 0
}

/** Toshkent sanasi `date` ga tegishli, vaqti yaroqli, takrorlanmagan eventlar. */
function onTashkentDate(events, date, label) {
  // id'siz eventlar takrorni aniqlab bo'lmagani uchun oldindan tashlanadi
  const valid = events.filter(isUsableEvent)
  if (valid.length < events.length) {
    logPartial(label, new Error(`${events.length - valid.length} ta event vaqtsiz yoki id'siz — tashlandi`))
  }
  const seen = new Set()
  return valid.filter(ev => {
    if (dateStr(ev.startTimestamp) !== date || seen.has(ev.id)) return false
    seen.add(ev.id)
    return true
  })
}

// SofaScore scheduled-events/{date} UTC kuni bo'yicha. Toshkent kuni D = UTC [D-1 19:00, D 19:00),
// shu bois UTC D-1 va D birlashtirilib, Toshkent sanasi bo'yicha filtrlanadi.
async function scheduledFor(date) {
  const utcDays = [shiftDate(date, -1), date]
  const results = await Promise.allSettled(utcDays.map(d => j(`/events/date/${d}`)))
  const hard = results.find(r => r.status === 'rejected' && !(r.reason instanceof NotFoundError))
  if (hard) throw hard.reason // 403 / 5xx / timeout — live zaxirasiga O'TILMAYDI
  const ok = results.filter(r => r.status === 'fulfilled')
  const events = ok.flatMap(r => (Array.isArray(r.value.events) ? r.value.events : []))
  return { events, missing: results.length - ok.length }
}

async function liveFallback(date) {
  try {
    const live = await j('/events/live')
    return Array.isArray(live.events) ? live.events : []
  } catch (err) {
    throw new UpstreamError(`o'yinlar manbasi ishlamadi (${date}): scheduled 404, live xato`, {
      status: err instanceof UpstreamError ? err.status : 502,
      cause: err,
    })
  }
}

/**
 * Sana (Toshkent) bo'yicha xom eventlar.
 * - scheduled to'liq → { partial: false }
 * - scheduled qisman 404 → mavjud qismi, { partial: true }
 * - scheduled butunlay 404 → /events/live zaxirasi (faqat jonli o'yinlar), { partial: true }
 * - 403/5xx/timeout yoki zaxira ham yiqilsa → UpstreamError
 * @returns {Promise<{ events: object[], partial: boolean }>}
 */
export async function eventsForDate(date) {
  const sched = await scheduledFor(date)
  if (sched.missing === 0) return { events: onTashkentDate(sched.events, date, 'events/date'), partial: false }
  if (sched.missing === 1) {
    logPartial(`events/date/${date}`, new Error('UTC kunlaridan biri 404 — natija qisman'))
    return { events: onTashkentDate(sched.events, date, 'events/date'), partial: true }
  }
  logPartial(`events/date/${date}`, new Error('scheduled 404 → live zaxirasi'))
  return { events: onTashkentDate(await liveFallback(date), date, 'events/live'), partial: true }
}

/**
 * O'yinlar + qisman belgisi (T-01 /api/matches javobida `partial` ni yetkazadi).
 * @returns {Promise<{ matches: object[], partial: boolean }>}
 */
export async function matchesForDate(date) {
  const { events, partial } = await eventsForDate(date)
  // turnir mashhurligi bo'yicha tartib (kattalari yuqorida); asl massiv o'zgarmaydi
  const matches = [...events].sort((a, b) => popularity(b) - popularity(a)).map(ev => mapMatch(ev, date))
  return { matches, partial }
}

// ---- O'yinlar (sana bo'yicha) — eski shakl: massiv ----
export async function matchesByDate(date) {
  return (await matchesForDate(date)).matches
}

/**
 * "Asosiy o'yin": jonli o'yinlardan birinchisi, yo'q bo'lsa null.
 * @param {Array<{ status: string }>} matches
 */
export function pickFeatured(matches) {
  if (!Array.isArray(matches)) throw new TypeError('pickFeatured: massiv kutilgan')
  return matches.find(m => m?.status === 'live') ?? null
}

// ---- Dominant turnir (bugungi o'yinlardan eng mashhuri); o'yin yo'q bo'lsa null ----
export async function dominantTournament(date) {
  const { events } = await eventsForDate(date)
  const byT = new Map()
  for (const ev of events) {
    const ut = ev.tournament?.uniqueTournament
    if (!ut?.id || !ev.season?.id) continue
    const cur = byT.get(ut.id) || { tid: ut.id, sid: ev.season.id, count: 0, pop: ut.userCount || 0 }
    byT.set(ut.id, { ...cur, count: cur.count + 1 })
  }
  return [...byT.values()].sort((a, b) => b.pop - a.pop || b.count - a.count)[0] || null
}

// ---- Bombardirlar (dominant turnir); bugun o'yin yo'q yoki statistika yo'q → [] ----
export async function scorers(date) {
  const best = await dominantTournament(date)
  if (!best) return []
  try {
    const data = await j(`/tournaments/${best.tid}/season/${best.sid}/top-players/overall`)
    return (data.topPlayers?.goals || []).slice(0, SCORERS_LIMIT).map(mapScorer)
  } catch (err) {
    if (err instanceof NotFoundError) return [] // turnirda bombardirlar statistikasi mavjud emas
    throw err
  }
}

/** Dominant turnir jadvalining birinchi guruh qatorlari; o'yin yoki jadval yo'q → []. */
export async function dominantStandingRows(date) {
  const best = await dominantTournament(date)
  if (!best) return []
  try {
    const data = await j(`/tournaments/${best.tid}/season/${best.sid}/standings`)
    return data.standings?.[0]?.rows || []
  } catch (err) {
    if (err instanceof NotFoundError) return [] // kubok bosqichi — jadval mavjud emas
    throw err
  }
}

// ---- Mini jadval (top-5) ----
export async function standingsMini(date) {
  const rows = await dominantStandingRows(date)
  return rows.slice(0, MINI_STANDINGS_LIMIT).map(r => ({
    pos: r.position,
    club: r.team?.shortName || r.team?.name || '',
    pts: r.points ?? null,
  }))
}
