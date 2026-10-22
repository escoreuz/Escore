// Liga, jamoa, murabbiy, davlatlar (API-Football).

import { NotFoundError } from '../errors.js'
import { createPartial } from '../sofa/log.js'
import { arr, mapFixtures, mapScorer, mapStandingGroups, num, resultFor } from './mappers.js'
import { TTL } from './matches.js'

const LEAGUE_FIXTURES = 10
const TEAM_FIXTURES = 5
const LEAGUE_SCORERS_LIMIT = 10
const SQUAD_GROUPS = [
  ['Goalkeeper', 'G', 'Darvozabonlar'],
  ['Defender', 'D', 'Himoyachilar'],
  ['Midfielder', 'M', 'Yarim himoyachilar'],
  ['Attacker', 'F', 'Hujumchilar'],
]

const withStale = (meta, stale) => (stale ? { ...meta, stale: true } : meta)

/** Bir nechta ixtiyoriy so'rov: 404 → fallback, Upstream → fallback + unavailable. */
async function sections(part, tracker, entries) {
  const results = await Promise.allSettled(entries.map(([, p]) => p))
  return entries.map(([name, , fallback], i) => {
    const r = part.take(results[i], name, null)
    if (r?.stale) tracker.stale = true
    return r ? r.data : fallback
  })
}

export async function leagueInfo(client, id) {
  const res = await client.get('/leagues', { id }, TTL.catalog)
  const item = arr(res.data)[0]
  if (!item?.league?.id) throw new NotFoundError(`liga topilmadi: ${id}`)
  return { item, stale: res.stale }
}

export async function league(client, id, seasonArg) {
  const { item, stale } = await leagueInfo(client, id)
  const seasons = arr(item.seasons).filter(s => Number.isFinite(s?.year))
  const season = seasonArg ?? seasons.find(s => s.current)?.year ?? seasons.at(-1)?.year ?? null
  const part = createPartial(`apisports/leagues/${id}`)
  const t = { stale }
  const q = { league: id, season }
  const [table, last, next, top] = season
    ? await sections(part, t, [
        ['standings', client.get('/standings', q, TTL.table), []],
        ['matches/last', client.get('/fixtures', { ...q, last: LEAGUE_FIXTURES }, TTL.teamFixtures), []],
        ['matches/next', client.get('/fixtures', { ...q, next: LEAGUE_FIXTURES }, TTL.teamFixtures), []],
        ['scorers', client.get('/players/topscorers', q, TTL.table), []],
      ])
    : [[], [], [], []]
  const groups = mapStandingGroups(table)
  return {
    league: {
      id: String(id),
      name: item.league.name || null,
      country: item.country?.name || '',
      flag: null,
      logo: item.league.logo || null,
    },
    seasons: [...seasons].reverse().map(s => ({ id: s.year, year: String(s.year) })),
    currentSeasonId: season,
    stages: null,
    teamCount: groups.reduce((n, g) => n + g.rows.length, 0),
    groups,
    rows: groups[0]?.rows || [],
    matches: mapFixtures([...arr(last), ...arr(next)], `leagues/${id}/fixtures`),
    scorers: arr(top).slice(0, LEAGUE_SCORERS_LIMIT).map(mapScorer),
    meta: withStale({ unavailable: part.unavailable }, t.stale),
  }
}

function squadGroups(data) {
  const players = arr(arr(data)[0]?.players)
  return SQUAD_GROUPS.map(([position, pos, label]) => ({
    label,
    players: players
      .filter(p => p?.position === position)
      .map(p => ({ id: p.id ?? null, n: num(p.number), flag: null, name: p.name || null, pos, age: num(p.age) })),
  })).filter(g => g.players.length)
}

/** Jamoaning joriy murabbiyi (/coachs?team): career da shu jamoa, tugash sanasi yo'q. */
function currentCoach(data, teamId) {
  const list = arr(data)
  return list.find(c => arr(c?.career).some(x => x?.team?.id === teamId && !x.end)) || list[0] || null
}

function mostFrequentLeague(fixtures) {
  const count = new Map()
  for (const fx of fixtures) if (fx?.league?.id != null) count.set(fx.league.id, (count.get(fx.league.id) || 0) + 1)
  const best = [...count].sort((a, b) => b[1] - a[1])[0]
  if (!best) return null
  const lg = fixtures.find(fx => fx.league?.id === best[0]).league
  return { id: String(lg.id), name: lg.name || null }
}

export async function team(client, id) {
  const main = await client.get('/teams', { id }, TTL.entity)
  const item = arr(main.data)[0]
  if (!item?.team?.id) throw new NotFoundError(`jamoa topilmadi: ${id}`)
  const part = createPartial(`apisports/teams/${id}`)
  const t = { stale: main.stale }
  const [squad, last, next, coaches] = await sections(part, t, [
    ['squad', client.get('/players/squads', { team: id }, TTL.entity), []],
    ['matches/last', client.get('/fixtures', { team: id, last: TEAM_FIXTURES }, TTL.teamFixtures), []],
    ['matches/next', client.get('/fixtures', { team: id, next: TEAM_FIXTURES }, TTL.teamFixtures), []],
    ['coach', client.get('/coachs', { team: id }, TTL.entity), []],
  ])
  const lastSorted = [...arr(last)].sort((a, b) => (a?.fixture?.timestamp ?? 0) - (b?.fixture?.timestamp ?? 0))
  const coach = currentCoach(coaches, item.team.id)
  const lg = mostFrequentLeague([...arr(last), ...arr(next)])
  return {
    name: item.team.name,
    id: item.team.id,
    color: null,
    country: item.team.country || '',
    standing: null,
    leagueId: lg?.id ?? null,
    league: { flag: null, name: lg?.name ?? null },
    info: {
      stadium: item.venue?.name || null,
      city: item.venue?.city || null,
      coach: coach?.name || null,
      coachId: coach?.id ?? null,
      founded: num(item.team.founded),
    },
    form: lastSorted.map(fx => resultFor(fx, item.team.id)).filter(Boolean),
    squad: squadGroups(squad),
    matches: mapFixtures([...arr(next), ...arr(last)], `teams/${id}/fixtures`).sort((a, b) => b.ts - a.ts),
    meta: withStale({ unavailable: part.unavailable }, t.stale),
  }
}

export async function coach(client, id) {
  const main = await client.get('/coachs', { id }, TTL.entity)
  const c = arr(main.data)[0]
  if (!c?.id) throw new NotFoundError(`murabbiy topilmadi: ${id}`)
  const part = createPartial(`apisports/coachs/${id}`)
  const t = { stale: main.stale }
  const teamId = c.team?.id
  const [last] = teamId
    ? await sections(part, t, [
        ['matches', client.get('/fixtures', { team: teamId, last: TEAM_FIXTURES }, TTL.teamFixtures), []],
      ])
    : [[]]
  const career = arr(c.career)
    .filter(x => x?.team)
    .map(x => ({
      club: x.team.name || null,
      id: x.team.id ?? null,
      c: null,
      from: x.start || null,
      to: x.end || null,
      games: null,
      ppg: null,
      trophies: null,
    }))
  return {
    name: c.name,
    id: c.id,
    team: c.team?.name || null,
    teamId: teamId ?? null,
    teamColor: null,
    flag: null,
    country: c.nationality || null,
    age: num(c.age),
    formation: null,
    totalGames: null,
    totalTrophies: null,
    record: { games: null, w: null, d: null, l: null, ppg: null, winPct: null },
    career,
    matches: mapFixtures(last, `coachs/${id}/fixtures`).sort((a, b) => b.ts - a.ts),
    meta: withStale({ unavailable: part.unavailable }, t.stale),
  }
}

/** Davlatlar: API'da raqamli id yo'q → nom bo'yicha saralangan ro'yxatdagi tartib raqami (1..n). */
export async function countryList(client) {
  const { data } = await client.get('/countries', {}, TTL.catalog)
  return arr(data)
    .filter(c => typeof c?.name === 'string' && c.name)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c, i) => ({ id: i + 1, name: c.name }))
}

export async function countryLeagues(client, id) {
  const country = (await countryList(client)).find(c => c.id === Number(id))
  if (!country) throw new NotFoundError(`davlat topilmadi: ${id}`)
  const { data } = await client.get('/leagues', { country: country.name }, TTL.catalog)
  return arr(data)
    .filter(x => x?.league?.id != null)
    .map(x => ({ id: x.league.id, name: x.league.name || null }))
}
