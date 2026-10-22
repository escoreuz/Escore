// O'yinlar (sana bo'yicha), o'yin tafsiloti, bombardirlar, mini jadval va bosh sahifa.

import { NotFoundError, UpstreamError } from '../errors.js'
import { days } from '../sofa/dates.js'
import { createPartial } from '../sofa/log.js'
import {
  TOP_LEAGUES,
  arr,
  byPopularity,
  mapEvents,
  mapFixture,
  mapFixtures,
  mapLineups,
  mapScorer,
  mapStandingGroups,
  mapStats,
  mapStatus,
} from './mappers.js'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
export const TTL = {
  live: 3 * MIN,
  today: 10 * MIN,
  past: DAY,
  future: HOUR,
  finished: 7 * DAY,
  table: 6 * HOUR,
  entity: DAY,
  catalog: 7 * DAY,
  teamFixtures: HOUR,
}
const TIME_ZONE = 'Asia/Tashkent'
const SCORERS_LIMIT = 6
const MINI_LIMIT = 5
const HOME_STANDINGS_LIMIT = 6
const HOME_LIST_LIMIT = 6

const isLive = fx => mapStatus(fx?.fixture?.status?.short) === 'live'

/** Sana bo'yicha fixtures TTL: o'tgan 24 soat, kelajak 1 soat, bugun 10 daq (jonli bo'lsa 3 daq). */
export function fixturesTtl(date, today) {
  if (date < today) return () => TTL.past
  if (date > today) return () => TTL.future
  return data => (arr(data).some(isLive) ? TTL.live : TTL.today)
}

/** Fixture detail TTL: jonli 3 daq, tugagan 7 kun, boshqa 10 daq. */
export function detailTtl(data) {
  const status = mapStatus(arr(data)[0]?.fixture?.status?.short)
  if (status === 'live') return TTL.live
  if (status === 'ft' || status === 'canceled') return TTL.finished
  return TTL.today
}

export function pickFeatured(matches) {
  if (!Array.isArray(matches)) throw new TypeError('pickFeatured: massiv kutilgan')
  return matches.find(m => m?.status === 'live') ?? null
}

/** Kunning asosiy ligasi: top ligalar ustuvor, aks holda eng ko'p o'yinli. */
function dominantLeague(fixtures) {
  const byLeague = new Map()
  for (const fx of fixtures) {
    const lg = fx?.league
    if (lg?.id == null || !Number.isFinite(lg.season)) continue
    const cur = byLeague.get(lg.id) || { id: lg.id, season: lg.season, count: 0 }
    byLeague.set(lg.id, { ...cur, count: cur.count + 1 })
  }
  const list = [...byLeague.values()]
  const rank = l => (TOP_LEAGUES.includes(l.id) ? TOP_LEAGUES.indexOf(l.id) : TOP_LEAGUES.length)
  return list.sort((a, b) => rank(a) - rank(b) || b.count - a.count)[0] || null
}

export async function fixturesFor(client, date) {
  const today = days().today
  return client.get('/fixtures', { date, timezone: TIME_ZONE }, fixturesTtl(date, today))
}

export async function matchesForDate(client, date) {
  const { data, stale } = await fixturesFor(client, date)
  const matches = mapFixtures(data, `fixtures?date=${date}`).sort(byPopularity)
  // stale (kvota tugagan, eskirgan kesh) — foydalanuvchiga "qisman" sifatida ko'rsatiladi
  return { matches, partial: stale, stale }
}

export async function matchDetail(client, id) {
  const { data, stale } = await client.get('/fixtures', { id }, detailTtl)
  const fx = arr(data)[0]
  if (!fx?.fixture?.id) throw new NotFoundError(`o'yin topilmadi: ${id}`)
  const match = mapFixture(fx)
  const stats = mapStats(fx)
  return {
    match,
    league: match.league,
    played: ['live', 'ft', 'interrupted'].includes(match.status),
    events: mapEvents(fx),
    stats,
    vote: null,
    momentum: [],
    lineups: mapLineups(fx),
    venue: fx.fixture.venue?.name || null,
    referee: fx.fixture.referee || null,
    refereeId: null,
    meta: { unavailable: ['momentum'], ...(stale ? { stale: true } : {}) },
  }
}

export async function leagueTable(client, lg) {
  const { data } = await client.get('/standings', { league: lg.id, season: lg.season }, TTL.table)
  return mapStandingGroups(data)[0]?.rows || []
}

export async function scorers(client, date) {
  const lg = dominantLeague(arr((await fixturesFor(client, date)).data))
  if (!lg) return []
  const { data } = await client.get('/players/topscorers', { league: lg.id, season: lg.season }, TTL.table)
  return arr(data).slice(0, SCORERS_LIMIT).map(mapScorer)
}

export async function standingRows(client, date) {
  const lg = dominantLeague(arr((await fixturesFor(client, date)).data))
  return lg ? leagueTable(client, lg) : []
}

export async function standingsMini(client, date) {
  return (await standingRows(client, date)).slice(0, MINI_LIMIT).map(r => ({ pos: r.pos, club: r.name, pts: r.Pts }))
}

/** Bosh sahifa: yangilik API'da yo'q → source null (index store bilan to'ldiradi). */
export async function home(client) {
  const date = days().today
  const part = createPartial('apisports/home')
  const [mRes, sRes] = await Promise.allSettled([matchesForDate(client, date), standingRows(client, date)])
  const m = part.take(mRes, 'matches', { matches: [], partial: false })
  const rows = part.take(sRes, 'standings', [])
  if (part.unavailable.length === 2) throw new UpstreamError("bosh sahifa: API-Football bo'limlari yuklanmadi")
  const unavailable = part.unavailable.flatMap(n => (n === 'matches' ? ['results', 'fixtures'] : [n]))
  return {
    lead: null,
    secondary: [],
    columns: [],
    briefs: [],
    ticker: [],
    standings: rows.slice(0, HOME_STANDINGS_LIMIT).map(r => ({
      pos: r.pos,
      club: r.name,
      p: r.P,
      w: r.total.w,
      d: r.total.d,
      l: r.total.l,
      pts: r.Pts,
    })),
    results: m.matches
      .filter(x => x.status === 'ft')
      .slice(0, HOME_LIST_LIMIT)
      .map(x => ({ home: x.home.n, hs: x.hs, as: x.as, away: x.away.n })),
    fixtures: m.matches
      .filter(x => x.status === 'sched')
      .slice(0, HOME_LIST_LIMIT)
      .map(x => ({ time: x.time, ts: x.ts, home: x.home.n, away: x.away.n })),
    meta: { source: null, unavailable, partial: m.partial === true },
  }
}
