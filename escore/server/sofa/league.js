// Liga sahifasi (jadval + o'yinlar + bombardirlar), davlatlar, reytinglar.

import { BadRequestError } from '../errors.js'
import { arr, colorOf, flagFor, mapEvents, mapScorer } from './format.js'
import { invalidResponse, j } from './http.js'
import { createPartial } from './log.js'

const LEAGUE_SCORERS_LIMIT = 10
const RANKINGS_LIMIT = 60
const RANKING_TYPE = new Map([
  ['uefa', 1],
  ['fifa', 2],
])

// Bosqich nomlari (knockout) o'zbekcha qisqa belgilar
const STAGE_UZ = new Map([
  ['round-of-32', '1/16'],
  ['round-of-16', '1/8'],
  ['quarterfinals', '1/4'],
  ['semifinals', '1/2'],
  ['match-for-3rd-place', "3-o'rin"],
  ['final', 'Final'],
])

// Mavsum bo'limlari: meta.unavailable nomi → score-api yo'li
const SEASON_PARTS = [
  ['standings', 'standings'],
  ['standings/home', 'standings/home'],
  ['standings/away', 'standings/away'],
  ['stages', 'rounds'],
  ['matches/last', 'events/last'],
  ['matches/next', 'events/next'],
  ['scorers', 'top-players/overall'],
]

function splitRec(r) {
  return { w: r?.wins ?? null, d: r?.draws ?? null, l: r?.losses ?? null }
}

// Turnir bosqichlari progress chizig'i (faqat kubok — nomli knockout roundlari bo'lsa)
function buildStages(roundsData) {
  const rounds = arr(roundsData?.rounds).filter(r => r && typeof r === 'object')
  const named = rounds.filter(r => r.name)
  if (!named.length) return null // oddiy liga — bosqich yo'q
  const current = roundsData?.currentRound?.round
  const groupRounds = rounds.filter(r => !r.name).map(r => r.round)

  const stages = []
  if (groupRounds.length) stages.push({ name: 'Guruh', rounds: groupRounds })
  for (const r of named) stages.push({ name: STAGE_UZ.get(r.slug) || r.name, rounds: [r.round] })

  const curIdx = stages.findLastIndex(s => s.rounds.includes(current))
  return stages.map((s, i) => ({ name: s.name, done: curIdx >= 0 && i < curIdx, current: i === curIdx }))
}

/** Barcha guruhlardan jamoa id → {w,d,l} xaritasi. */
function recordsById(standingsData) {
  const out = new Map()
  for (const g of arr(standingsData?.standings)) {
    for (const r of arr(g?.rows)) if (r?.team?.id != null) out.set(r.team.id, splitRec(r))
  }
  return out
}

// Uy/mehmon bo'linishi faqat upstream'dan; yo'q bo'lsa null (umumiy natijadan uydirilmaydi).
function rowMapper(homeById, awayById) {
  return r => ({
    id: r.team?.id ?? null,
    pos: r.position ?? null,
    name: r.team?.shortName || r.team?.name || '',
    c: colorOf(r.team),
    P: r.matches ?? null,
    Pts: r.points ?? null,
    total: splitRec(r),
    home: homeById.get(r.team?.id) ?? null,
    away: awayById.get(r.team?.id) ?? null,
    GF: r.scoresFor ?? null,
    GA: r.scoresAgainst ?? null,
    GD: r.scoresFor != null && r.scoresAgainst != null ? r.scoresFor - r.scoresAgainst : null,
    form: [],
  })
}

/** Mavsum bo'yicha ma'lumotlar: 404 → null (mavjud emas), boshqa xato → null + unavailable. */
async function seasonData(id, sid, part) {
  if (!sid) return {}
  const base = `/tournaments/${id}/season/${sid}`
  const results = await Promise.allSettled(SEASON_PARTS.map(([, path]) => j(`${base}/${path}`)))
  return Object.fromEntries(SEASON_PARTS.map(([name], i) => [name, part.take(results[i], name, null)]))
}

export async function league(id, seasonId) {
  const [seasonsRes, tour] = await Promise.all([j(`/tournaments/${id}/seasons`), j(`/tournaments/${id}`)])
  const ut = tour.uniqueTournament
  if (!ut || typeof ut !== 'object') throw invalidResponse(`/tournaments/${id}`)
  const seasonList = arr(seasonsRes.seasons).map(s => ({ id: s?.id, year: s?.year }))
  const sid = seasonId || seasonList[0]?.id || null
  const part = createPartial(`tournaments/${id}`)
  const d = await seasonData(id, sid, part)

  // BARCHA guruhlar (A, B, C ... — Jahon chempionatida 12 guruh)
  const mapRow = rowMapper(recordsById(d['standings/home']), recordsById(d['standings/away']))
  const groups = arr(d.standings?.standings).map(g => ({
    name: g?.name || g?.tournament?.name || null,
    rows: arr(g?.rows).filter(Boolean).map(mapRow),
  }))
  const events = [...arr(d['matches/last']?.events), ...arr(d['matches/next']?.events)]
  const scorersList = arr(d.scorers?.topPlayers?.goals)
    .slice(0, LEAGUE_SCORERS_LIMIT)
    .map((g, i) => ({ ...mapScorer(g, i), assists: g?.statistics?.assists ?? null }))

  return {
    league: { id: String(id), name: ut.name || null, country: ut.category?.name || '', flag: flagFor(ut.category) },
    seasons: seasonList,
    currentSeasonId: sid,
    stages: buildStages(d.stages),
    teamCount: groups.reduce((n, g) => n + g.rows.length, 0),
    groups,
    rows: groups[0]?.rows || [], // moslik uchun (Team.jsx jadval tabi)
    matches: mapEvents(events, `tournaments/${id}/events`),
    scorers: scorersList,
    meta: { unavailable: part.unavailable },
  }
}

// ---- Davlatlar (kategoriyalar) ----
export async function countries() {
  const data = await j('/categories')
  return arr(data.categories)
    .filter(c => typeof c?.name === 'string' && c.name)
    .map(c => ({ id: c.id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// ---- Bitta davlatning ligalari ----
export async function countryLeagues(id) {
  const data = await j(`/category/${id}/tournaments`)
  return arr(data.groups).flatMap(g => arr(g?.uniqueTournaments).map(u => ({ id: u?.id, name: u?.name })))
}

// ---- Reyting (FIFA / UEFA) ----
export async function rankings(kind) {
  const typeId = RANKING_TYPE.get(kind)
  if (!typeId) throw new BadRequestError(`noma'lum reyting turi: ${String(kind)}`)
  const data = await j(`/rankings/${typeId}`)
  return arr(data.rankings)
    .slice(0, RANKINGS_LIMIT)
    .filter(r => r && typeof r === 'object')
    .map(r => ({
      rank: r.ranking ?? null,
      name: r.team?.name || r.team?.country?.name || r.name || r.rowName || null,
      teamId: r.team?.id ?? null,
      points: Number.isFinite(r.points ?? r.totalPoints) ? Math.round(r.points ?? r.totalPoints) : null,
      prev: r.previousRanking ?? null,
    }))
}
