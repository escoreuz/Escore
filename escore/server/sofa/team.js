// Jamoa sahifasi: ma'lumot, sostav, o'yinlar, forma.

import { yearFrom } from './dates.js'
import { ageFrom, arr, colorOf, flagEmoji, flagFor, mapEvents, resultFromWinner } from './format.js'
import { invalidResponse, j } from './http.js'
import { createPartial } from './log.js'

const SQUAD_GROUPS = { G: 'Darvozabonlar', D: 'Himoyachilar', M: 'Yarim himoyachilar', F: 'Hujumchilar' }
const SQUAD_ORDER = ['G', 'D', 'M', 'F']
const FORM_LENGTH = 5

/** Sostavni pozitsiya bo'yicha guruhlaydi. */
function buildSquad(entries) {
  const buckets = new Map()
  for (const e of arr(entries)) {
    const p = e?.player
    if (!p) continue
    const pos = p.position || 'M'
    const list = buckets.get(pos) || []
    list.push({
      id: p.id,
      n: p.jerseyNumber || '',
      flag: flagEmoji(p.country?.alpha2),
      name: p.shortName || p.name,
      pos,
      age: ageFrom(p.dateOfBirthTimestamp),
    })
    buckets.set(pos, list)
  }
  return SQUAD_ORDER.filter(k => buckets.get(k)?.length).map(k => ({ label: SQUAD_GROUPS[k], players: buckets.get(k) }))
}

/**
 * Jamoa nuqtai nazaridan natija: 'G' / 'D' / 'M'; aniqlab bo'lmasa null.
 * Hisob bo'lmasa (texnik g'alaba / awarded) winnerCode ishlatiladi.
 */
export function formResult(ev, teamId) {
  const isHome = ev.homeTeam?.id === teamId
  const hs = ev.homeScore?.current ?? null
  const as = ev.awayScore?.current ?? null
  if (typeof hs === 'number' && typeof as === 'number') {
    const my = isHome ? hs : as
    const opp = isHome ? as : hs
    return my > opp ? 'G' : my === opp ? 'D' : 'M'
  }
  return resultFromWinner(ev.winnerCode, isHome ? 'home' : 'away')
}

export async function team(id) {
  const [td, sq, last, next] = await Promise.allSettled([
    j(`/teams/${id}`),
    j(`/teams/${id}/players`),
    j(`/teams/${id}/events/last`),
    j(`/teams/${id}/events/next`),
  ])
  if (td.status === 'rejected') throw td.reason
  const t = td.value.team
  if (!t || typeof t !== 'object') throw invalidResponse(`/teams/${id}`)
  const ut = t.primaryUniqueTournament || t.tournament?.uniqueTournament || {}
  const part = createPartial(`teams/${id}`)

  const players = part.take(sq, 'squad', null)?.players
  const lastEvs = arr(part.take(last, 'matches/last', null)?.events).filter(e => e && typeof e === 'object')
  const nextEvs = arr(part.take(next, 'matches/next', null)?.events).filter(e => e && typeof e === 'object')
  // o'yinlar (o'tgan + kelajak), eng yangisi tepada; vaqtsiz eventlar log bilan tashlanadi
  const matches = mapEvents(
    [...lastEvs, ...nextEvs].sort((a, b) => (b?.startTimestamp || 0) - (a?.startTimestamp || 0)),
    `teams/${id}/events`,
  )
  // forma — oxirgi 5 tugagan o'yindan (natijasi aniqlanmaganlari tashlanadi)
  const form = lastEvs
    .filter(e => e.status?.type === 'finished')
    .map(e => formResult(e, t.id))
    .filter(Boolean)
    .slice(-FORM_LENGTH)

  return {
    name: t.name,
    id: t.id,
    color: colorOf(t),
    country: t.country?.name || ut.category?.name || '',
    standing: null,
    leagueId: ut.id == null ? null : String(ut.id),
    league: { flag: flagFor(ut.category), name: ut.name || null },
    info: {
      stadium: t.venue?.stadium?.name || null,
      city: t.venue?.city?.name || null,
      coach: t.manager?.name || null,
      coachId: t.manager?.id || null,
      founded: yearFrom(t.foundationDateTimestamp),
    },
    form,
    squad: buildSquad(players),
    matches,
    meta: { unavailable: part.unavailable },
  }
}
