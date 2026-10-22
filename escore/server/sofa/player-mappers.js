// O'yinchi sahifasi uchun sof mapperlar (tarmoqqa murojaat yo'q).

import { dayKey, lastMonths, tashkentParts } from './dates.js'
import { arr, isUsableEvent, mapMatch, ratingText, resultFromWinner } from './format.js'

const MONTHS_UZ = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek']
const MONTHLY_WINDOW = 12
const RECENT_LIMIT = 15
const MILLION = 1e6
const THOUSAND = 1e3
const TEN_MILLION = 1e7

const ATTR_LABELS = [
  ['Hujum', 'attacking'],
  ['Texnika', 'technical'],
  ['Taktika', 'tactical'],
  ['Himoya', 'defending'],
  ['Ijod', 'creativity'],
]

/** Radar atributlari; ma'lumot yo'q bo'lsa [] (uydirma nollar yo'q). */
export function attrsFrom(overview) {
  const a = overview?.playerAttributeOverviews?.[0] || overview?.averageAttributeOverviews?.[0]
  if (!a || typeof a !== 'object') return []
  return ATTR_LABELS.map(([label, key]) => ({ label, val: Number.isFinite(a[key]) ? a[key] : null }))
}

// O'yinchi qaysi tomonda o'ynagan (klub yoki milliy jamoa)
export function playerSide(ev, clubId, countryName) {
  if (ev.homeTeam?.id === clubId) return 'home'
  if (ev.awayTeam?.id === clubId) return 'away'
  if (ev.homeTeam?.national && ev.homeTeam?.country?.name === countryName) return 'home'
  if (ev.awayTeam?.national && ev.awayTeam?.country?.name === countryName) return 'away'
  return null
}

/** last-year-summary'dan reytingli o'yin yozuvlari. */
function ratedEvents(summary) {
  return arr(summary).filter(e => e?.type === 'event' && e.value && Number.isFinite(e.timestamp))
}

// So'nggi 12 oy — oylik o'rtacha reyting (last-year-summary'dan), Toshkent oylari bo'yicha
export function monthlyRatings(summary) {
  const byMonth = new Map()
  for (const e of ratedEvents(summary)) {
    const p = tashkentParts(new Date(e.timestamp * 1000))
    const key = `${p.year}-${p.month - 1}`
    const b = byMonth.get(key) || { sum: 0, n: 0 }
    byMonth.set(key, { sum: b.sum + parseFloat(e.value), n: b.n + 1 })
  }
  return lastMonths(MONTHLY_WINDOW).map(({ year, month0 }) => {
    const b = byMonth.get(`${year}-${month0}`)
    return { label: MONTHS_UZ[month0], rating: b ? +(b.sum / b.n).toFixed(1) : null }
  })
}

/** Kun → reyting xaritasi; `tid` berilsa faqat shu turnir. */
export function ratingsByDay(summary, tid) {
  const out = new Map()
  for (const e of ratedEvents(summary)) {
    if (tid != null && String(e.uniqueTournamentId) !== String(tid)) continue
    out.set(dayKey(e.timestamp), e.value)
  }
  return out
}

/** O'yinchi o'ynagan ligalar ro'yxati (dropdown uchun — har turnir + so'nggi mavsumi). */
export function seasonsListFrom(seasonsData) {
  return arr(seasonsData?.uniqueTournamentSeasons)
    .filter(u => u?.uniqueTournament?.id != null)
    .map(u => ({
      tid: u.uniqueTournament.id,
      sid: u.seasons?.[0]?.id,
      name: u.uniqueTournament.name,
      year: u.seasons?.[0]?.year,
    }))
    .filter(x => x.sid)
}

/** Mavsum xulosasi (summary kartasi) — player() va playerSeason() uchun umumiy. Yo'q maydon → null. */
export function seasonTotals(s, isGK) {
  const apps = s.appearances ?? null
  return {
    rating: ratingText(s),
    appearances: apps,
    started: s.matchesStarted ?? null,
    minutesPerGame: apps && Number.isFinite(s.minutesPlayed) ? Math.round(s.minutesPlayed / apps) : null,
    totalMinutes: s.minutesPlayed ?? null,
    isGK,
    goals: s.goals ?? null,
    assists: s.assists ?? null,
    saves: s.saves ?? null,
    cleanSheet: s.cleanSheet ?? null,
    goalsConceded: s.goalsConceded ?? null,
  }
}

/** Statistika jadvali guruhlari (yo'q maydon → null). */
export function statRowsFrom(s, title, rating) {
  return [
    {
      group: title,
      rows: [
        ["O'yinlar", s.appearances ?? null],
        ['Daqiqalar', s.minutesPlayed ?? null],
        ['Reyting', rating],
      ],
    },
    {
      group: 'Hujum',
      rows: [
        ['Gollar', s.goals ?? null],
        ['Assistlar', s.assists ?? null],
        ['Zarbalar', s.totalShots ?? null],
      ],
    },
    {
      group: 'Aniqlik / Himoya',
      rows: [
        ['Uzatmalar', s.totalPasses ?? null],
        ['Aniq uzatma %', s.accuratePassesPercentage ? Math.round(s.accuratePassesPercentage) + '%' : null],
        ['Tortib olishlar', s.tackles ?? null],
      ],
    },
  ]
}

/** So'nggi o'yinlar (natija + reyting bilan), eng yangisi tepada. */
export function recentMatches(events, p, ratingByDay) {
  const clubId = p.team?.id
  const cName = p.country?.name
  return arr(events)
    .filter(isUsableEvent)
    .slice(-RECENT_LIMIT)
    .reverse()
    .map(ev => {
      const side = playerSide(ev, clubId, cName)
      return {
        m: mapMatch(ev),
        isHome: side === 'home' || (side === null && ev.homeTeam?.id === clubId),
        result: resultFromWinner(ev.winnerCode, side),
        rating: ratingByDay.get(dayKey(ev.startTimestamp)) || null,
      }
    })
}

/** Bozor qiymati matni (235 ming €, 12.5 mln € va h.k.). */
export function marketValueText(rawVal) {
  if (rawVal >= MILLION) return (rawVal / MILLION).toFixed(rawVal >= TEN_MILLION ? 0 : 1) + ' mln €'
  if (rawVal >= THOUSAND) return Math.round(rawVal / THOUSAND) + ' ming €'
  return rawVal ? rawVal + ' €' : null
}
