// O'yinchi sahifasi, karyerasi va tanlangan mavsum (API-Football).
// API'da atributlar, heatmap, oylik reyting, bozor qiymati yo'q → [] / null + meta.unavailable.

import { NotFoundError } from '../errors.js'
import { seasonTotals, statRowsFrom } from '../sofa/player-mappers.js'
import { arr, num } from './mappers.js'
import { TTL } from './matches.js'

const POS_LABEL = new Map([
  ['Goalkeeper', 'Darvozabon'],
  ['Defender', 'Himoyachi'],
  ['Midfielder', 'Yarim himoyachi'],
  ['Attacker', 'Hujumchi'],
])
const PLAYER_UNAVAILABLE = ['attrs', 'heatmap', 'monthly', 'recent']
// Mavsumda maydonga tushmagan — aniq nollar (sofa playerSeason bilan bir xil qoida)
const NO_APPEARANCES = Object.freeze({
  appearances: 0,
  matchesStarted: 0,
  minutesPlayed: 0,
  goals: 0,
  assists: 0,
  saves: 0,
  cleanSheet: 0,
  goalsConceded: 0,
})

/** API-Football statistics bloki → sofa statistika kalitlari (umumiy mapperlar uchun). */
function toSofaStats(st) {
  const rating = Number.parseFloat(st?.games?.rating)
  return {
    appearances: num(st?.games?.appearences),
    matchesStarted: num(st?.games?.lineups),
    minutesPlayed: num(st?.games?.minutes),
    goals: num(st?.goals?.total),
    assists: num(st?.goals?.assists),
    saves: num(st?.goals?.saves),
    cleanSheet: null,
    goalsConceded: num(st?.goals?.conceded),
    rating: Number.isFinite(rating) ? rating : null,
    totalShots: num(st?.shots?.total),
    totalPasses: num(st?.passes?.total),
    accuratePassesPercentage: num(Number.parseFloat(st?.passes?.accuracy)),
    tackles: num(st?.tackles?.total),
  }
}

/** Asosiy statistika bloki — eng ko'p o'yin o'tkazilgan turnir. */
function primaryStats(item) {
  return [...arr(item?.statistics)].sort((a, b) => (b?.games?.appearences ?? 0) - (a?.games?.appearences ?? 0))[0]
}

export async function latestSeason(client, id) {
  const { data, stale } = await client.get('/players/seasons', { player: id }, TTL.entity)
  const years = arr(data).filter(Number.isFinite)
  if (!years.length) throw new NotFoundError(`o'yinchi topilmadi: ${id}`)
  return { season: Math.max(...years), stale }
}

export async function playerItem(client, id, season) {
  const { data, stale } = await client.get('/players', { id, season }, TTL.entity)
  const item = arr(data)[0]
  if (!item?.player?.id) throw new NotFoundError(`o'yinchi topilmadi: ${id}`)
  return { item, stale }
}

function summaryOf(st, isGK) {
  if (!st) return { rating: null, seasonSummary: null, statRows: [] }
  const s = toSofaStats(st)
  const totals = seasonTotals(s, isGK)
  return {
    rating: totals.rating,
    seasonSummary: {
      tournament: st.league?.name || null,
      tournamentId: st.league?.id ?? null,
      season: st.league?.season == null ? null : String(st.league.season),
      heatmap: [],
      ...totals,
    },
    statRows: statRowsFrom(s, `${st.league?.name ?? ''} ${st.league?.season ?? ''}`.trim(), totals.rating),
  }
}

export async function player(client, id) {
  const ls = await latestSeason(client, id)
  const { item, stale } = await playerItem(client, id, ls.season)
  const p = item.player
  const st = primaryStats(item)
  const isGK = st?.games?.position === 'Goalkeeper'
  const sum = summaryOf(st, isGK)
  return {
    name: p.name,
    id: p.id,
    team: st?.team?.name || null,
    teamId: st?.team?.id ?? null,
    teamColor: null,
    posLabel: POS_LABEL.get(st?.games?.position) || st?.games?.position || '',
    overall: sum.rating,
    rating: sum.rating,
    value: null,
    valueText: null,
    monthly: [],
    seasonSummary: sum.seasonSummary,
    seasonsList: arr(item.statistics)
      .filter(x => x?.league?.id != null)
      .map(x => ({
        tid: x.league.id,
        sid: x.league.season,
        name: x.league.name || null,
        year: String(x.league.season),
      })),
    followers: null,
    base: {
      number: num(st?.games?.number),
      flag: null,
      country: p.nationality || null,
      age: num(p.age),
      birth: p.birth?.date || null,
      height: p.height || null,
      foot: null,
    },
    attrs: [],
    strengths: [],
    weaknesses: [],
    stats: sum.statRows,
    recent: [],
    meta: { unavailable: [...PLAYER_UNAVAILABLE], ...(stale || ls.stale ? { stale: true } : {}) },
  }
}

/** Karyera: /players/teams — jamoa × mavsum (statistikasiz; API bitta so'rovda bermaydi). */
export async function playerCareer(client, id) {
  const ls = await latestSeason(client, id)
  const [{ item }, teams] = await Promise.all([
    playerItem(client, id, ls.season),
    client.get('/players/teams', { player: id }, TTL.entity),
  ])
  const rows = arr(teams.data)
    .filter(x => x?.team)
    .flatMap(x =>
      arr(x.seasons).map(year => ({
        year: String(year),
        tournament: x.team.name || null,
        teamId: x.team.id ?? null,
        mp: null,
        min: null,
        rating: null,
        cls: null,
        gc: null,
        goals: null,
        assists: null,
      })),
    )
    .sort((a, b) => b.year.localeCompare(a.year))
  const isGK = primaryStats(item)?.games?.position === 'Goalkeeper'
  return { isGK, rows, partial: false, failedSeasons: [], truncated: false }
}

export async function playerSeason(client, id, tid, sid) {
  const { item, stale } = await playerItem(client, id, sid)
  const st = arr(item.statistics).find(x => String(x?.league?.id) === String(tid))
  const isGK = (st ?? primaryStats(item))?.games?.position === 'Goalkeeper'
  return {
    summary: seasonTotals(st ? toSofaStats(st) : NO_APPEARANCES, isGK),
    heatmap: [],
    timeline: [],
    meta: { unavailable: ['heatmap', 'timeline'], ...(stale ? { stale: true } : {}) },
  }
}
