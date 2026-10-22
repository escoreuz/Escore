// O'yin tafsiloti: hodisalar, statistika, tarkiblar, momentum grafigi.

import { arr, hasValidStart, mapMatch } from './format.js'
import { invalidResponse, j } from './http.js'
import { createPartial } from './log.js'

const POS_MAP = { G: 'DG', D: 'HIM', M: 'YN', F: 'HJ' }
const MIN_CHOSEN_STATS = 4
const FALLBACK_STATS_LIMIT = 8
const VOTE_SPREAD = 60
const VOTE_BASE = 13
const VOTE_MIN_DRAW = 8

function mapIncident(x) {
  const team = x.isHome ? 'home' : 'away'
  if (x.incidentType === 'goal') {
    return {
      min: x.time,
      team,
      type: 'goal',
      player: x.player?.shortName || x.player?.name || '',
      assist: x.assist1?.shortName || x.assist1?.name || null,
    }
  }
  if (x.incidentType === 'card') {
    const cls = (x.incidentClass || '').toLowerCase()
    const type = cls.includes('red') || cls === 'yellowred' ? 'red' : 'yellow'
    return { min: x.time, team, type, player: x.player?.shortName || x.playerName || '' }
  }
  return null
}

function mapIncidents(data) {
  return arr(data?.incidents)
    .filter(x => x && typeof x === 'object')
    .map(mapIncident)
    .filter(Boolean)
    .sort((a, b) => a.min - b.min)
}

const STAT_KEYS = [
  'ballPossession',
  'expectedGoals',
  'totalShotsOnGoal',
  'shotsOnGoal',
  'bigChanceCreated',
  'cornerKicks',
  'fouls',
  'offsides',
  'yellowCards',
]

function mapStats(data) {
  const all = arr(data?.statistics).find(s => s?.period === 'ALL')
  if (!all) return []
  const items = arr(all.groups)
    .flatMap(g => arr(g?.statisticsItems))
    .filter(it => it && typeof it === 'object')
  const byKey = new Map(items.map(it => [it.key, it]))
  const chosen = STAT_KEYS.map(k => byKey.get(k)).filter(Boolean)
  const list = chosen.length >= MIN_CHOSEN_STATS ? chosen : items.slice(0, FALLBACK_STATS_LIMIT)
  const str = v => (v == null ? null : String(v))
  return list.map(it => ({ label: it.name ?? null, home: str(it.home), away: str(it.away), bar: true }))
}

function mapSide(side) {
  if (!side) return { formation: '', lines: [], players: [] }
  const formation = side.formation || ''
  const lines = formation ? formation.split('-').map(Number) : []
  const starters = arr(side.players).filter(p => p && !p.substitute)
  const players = starters.map(p => ({
    id: p.player?.id,
    n: p.shirtNumber || p.jerseyNumber || p.player?.jerseyNumber || null,
    name: p.player?.shortName || p.player?.name || '',
    pos: POS_MAP[p.player?.position] || p.player?.position || 'YN',
  }))
  return { formation, lines, players }
}

function mapGraph(data) {
  const pts = arr(data?.graphPoints).filter(p => Number.isFinite(p?.value))
  if (!pts.length) return []
  const max = Math.max(1, ...pts.map(p => Math.abs(p.value)))
  return pts.map(p => Math.round((p.value / max) * 100))
}

// Bashorat ulushi faqat xG mavjud bo'lsa hisoblanadi; aks holda null (uydirma foiz yo'q).
function voteFrom(stats) {
  const xg = stats.find(s => /expected goals/i.test(s.label ?? ''))
  if (!xg) return null
  const hv = parseFloat(xg.home) || 0
  const av = parseFloat(xg.away) || 0
  const t = hv + av
  if (t <= 0) return null
  const home = Math.round((hv / t) * VOTE_SPREAD) + VOTE_BASE
  const away = Math.round((av / t) * VOTE_SPREAD) + VOTE_BASE
  return { home, draw: Math.max(VOTE_MIN_DRAW, 100 - home - away), away }
}

/**
 * O'yin tafsiloti. Asosiy event 404 → NotFoundError; yaroqsiz javob → UpstreamError.
 * Qo'shimcha bo'limlar (events/stats/lineups/momentum): 404 → bo'sh (mavjud emas),
 * boshqa xato → bo'sh + meta.unavailable (yuklanmadi).
 */
export async function matchDetail(id) {
  const wrap = await j(`/events/${id}`)
  const event = wrap.event || wrap
  if (event?.id == null || !hasValidStart(event)) throw invalidResponse(`/events/${id}`)
  const match = mapMatch(event)
  const part = createPartial(`events/${id}`)

  const [inc, st, lu, gr] = await Promise.allSettled([
    j(`/events/${id}/incidents`),
    j(`/events/${id}/statistics`),
    j(`/events/${id}/lineups`),
    j(`/events/${id}/graph`),
  ])
  const stats = mapStats(part.take(st, 'stats', null))
  const lineupData = part.take(lu, 'lineups', null)
  const events = mapIncidents(part.take(inc, 'events', null))
  const momentum = mapGraph(part.take(gr, 'momentum', null))

  return {
    match,
    league: match.league,
    played: ['live', 'ft', 'interrupted'].includes(match.status),
    events,
    stats,
    vote: voteFrom(stats),
    momentum,
    lineups: { home: mapSide(lineupData?.home), away: mapSide(lineupData?.away) },
    venue: event.venue?.stadium?.name || event.venue?.name || null,
    referee: event.referee?.name || null,
    refereeId: event.referee?.id || null,
    meta: { unavailable: part.unavailable },
  }
}
