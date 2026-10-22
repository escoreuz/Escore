// API-Football (v3) obyektlari → eSCORE javob shakllari (docs/API-NOTES.md "TASDIQLANGAN shakl").
// Upstream bermagan maydon — null (uydirma to'ldirish yo'q). Rang (c) API'da yo'q → null.

import { dateStr, timeStr } from '../sofa/dates.js'
import { logPartial } from '../sofa/log.js'

const STATUS = new Map([
  ...['NS', 'TBD'].map(s => [s, 'sched']),
  ...['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'].map(s => [s, 'live']),
  ...['FT', 'AET', 'PEN', 'AWD', 'WO'].map(s => [s, 'ft']),
  ['PST', 'postponed'],
  ['CANC', 'canceled'],
  ['ABD', 'canceled'],
  ['SUSP', 'interrupted'],
  ['INT', 'interrupted'],
])
const POS_SHORT = new Map([
  ['G', 'DG'],
  ['D', 'HIM'],
  ['M', 'YN'],
  ['F', 'HJ'],
])
const FORM_UZ = new Map([
  ['W', 'G'],
  ['D', 'D'],
  ['L', 'M'],
])
// Mashhur ligalar ustuvorligi: EPL, La Liga, Bundesliga, Serie A, Ligue 1, UCL, UEL
export const TOP_LEAGUES = [39, 140, 78, 135, 61, 2, 3]

export const arr = x => (Array.isArray(x) ? x : [])
export const num = v => (Number.isFinite(v) ? v : null)
const idStr = v => (v == null ? null : String(v))

/** Qisqa status kodi → eSCORE statusi; noma'lum → null. */
export function mapStatus(short) {
  return STATUS.get(short) ?? null
}

function teamOf(t) {
  return { n: t?.name || null, c: null, id: t?.id ?? null }
}

/** Fixture → match obyekti. */
export function mapFixture(fx) {
  const f = fx.fixture
  const lg = fx.league
  const ts = num(f?.timestamp)
  const status = mapStatus(f?.status?.short)
  return {
    id: String(f.id),
    date: dateStr(ts),
    leagueId: idStr(lg?.id),
    league: {
      id: idStr(lg?.id),
      name: lg?.name || null,
      country: lg?.country || '',
      flag: null,
      logo: lg?.logo || null,
    },
    time: timeStr(ts),
    ts,
    status,
    minute: status === 'live' ? num(f.status?.elapsed) : null,
    home: teamOf(fx.teams?.home),
    away: teamOf(fx.teams?.away),
    hs: num(fx.goals?.home),
    as: num(fx.goals?.away),
  }
}

/** Fixture ro'yxati: id yoki vaqti yo'q yozuvlar log bilan tashlanadi. */
export function mapFixtures(list, label) {
  const all = arr(list)
  const valid = all.filter(fx => fx?.fixture?.id != null && Number.isFinite(fx.fixture.timestamp))
  if (valid.length < all.length)
    logPartial(label, new Error(`${all.length - valid.length} ta fixture id/vaqtsiz — tashlandi`))
  return valid.map(mapFixture)
}

/** Ligalar ustuvorligi bo'yicha tartib (top ligalar, keyin liga id). */
export function byPopularity(a, b) {
  const rank = m => {
    const i = TOP_LEAGUES.indexOf(Number(m.leagueId))
    return i < 0 ? TOP_LEAGUES.length : i
  }
  return rank(a) - rank(b) || Number(a.leagueId ?? Infinity) - Number(b.leagueId ?? Infinity) || a.ts - b.ts
}

// ---- matchDetail qismlari ----
function sideOf(teamId, fx) {
  if (teamId != null && teamId === fx.teams?.home?.id) return 'home'
  if (teamId != null && teamId === fx.teams?.away?.id) return 'away'
  return null
}

export function mapEvents(fx) {
  const out = []
  for (const e of arr(fx.events)) {
    const team = sideOf(e?.team?.id, fx)
    const min = num(e?.time?.elapsed)
    if (!team || min === null) continue
    const type = String(e.type || '').toLowerCase()
    const detail = String(e.detail || '')
    if (type === 'goal' && !/missed/i.test(detail)) {
      out.push({ min, team, type: 'goal', player: e.player?.name || '', assist: e.assist?.name || null })
    } else if (type === 'card') {
      out.push({ min, team, type: /red|second yellow/i.test(detail) ? 'red' : 'yellow', player: e.player?.name || '' })
    }
  }
  return out.sort((a, b) => a.min - b.min)
}

export function mapStats(fx) {
  const homeId = fx.teams?.home?.id
  const blocks = arr(fx.statistics)
  const home = blocks.find(b => b?.team?.id === homeId)
  const away = blocks.find(b => b?.team?.id !== homeId)
  if (!home && !away) return []
  const awayBy = new Map(arr(away?.statistics).map(s => [s?.type, s?.value]))
  const str = v => (v == null ? null : String(v))
  return arr(home?.statistics)
    .filter(s => s?.type)
    .map(s => ({ label: s.type, home: str(s.value), away: str(awayBy.get(s.type)), bar: true }))
}

function mapSide(block) {
  if (!block) return { formation: '', lines: [], players: [] }
  const formation = block.formation || ''
  return {
    formation,
    lines: formation ? formation.split('-').map(Number) : [],
    players: arr(block.startXI).map(({ player: p } = {}) => ({
      id: p?.id ?? null,
      n: num(p?.number),
      name: p?.name || '',
      pos: POS_SHORT.get(p?.pos) || null,
    })),
  }
}

export function mapLineups(fx) {
  const blocks = arr(fx.lineups)
  return {
    home: mapSide(blocks.find(b => b?.team?.id === fx.teams?.home?.id)),
    away: mapSide(blocks.find(b => b?.team?.id === fx.teams?.away?.id)),
  }
}

// ---- jadval va bombardirlar ----
const rec = r => ({ w: num(r?.win), d: num(r?.draw), l: num(r?.lose) })

export function mapStandingRow(r) {
  return {
    id: r?.team?.id ?? null,
    pos: num(r?.rank),
    name: r?.team?.name || '',
    c: null,
    P: num(r?.all?.played),
    Pts: num(r?.points),
    total: rec(r?.all),
    home: r?.home ? rec(r.home) : null,
    away: r?.away ? rec(r.away) : null,
    GF: num(r?.all?.goals?.for),
    GA: num(r?.all?.goals?.against),
    GD: num(r?.goalsDiff),
    form: [...String(r?.form || '')].map(ch => FORM_UZ.get(ch)).filter(Boolean),
  }
}

/** /standings javobi → guruhlar [{ name, rows }]. */
export function mapStandingGroups(data) {
  const groups = arr(data?.[0]?.league?.standings)
  return groups.map(rows => ({
    name: arr(rows)[0]?.group || null,
    rows: arr(rows).filter(Boolean).map(mapStandingRow),
  }))
}

export function mapScorer(item, i) {
  const s = arr(item?.statistics)[0]
  return {
    rank: i + 1,
    id: item?.player?.id ?? null,
    teamId: s?.team?.id ?? null,
    name: item?.player?.name || '',
    team: s?.team?.name || '',
    goals: num(s?.goals?.total),
    assists: num(s?.goals?.assists),
    c: null,
  }
}

/** Jamoa nuqtai nazaridan natija ('G'|'D'|'M'), aniqlanmasa null. */
export function resultFor(fx, teamId) {
  const hs = num(fx.goals?.home)
  const as = num(fx.goals?.away)
  if (hs === null || as === null || mapStatus(fx.fixture?.status?.short) !== 'ft') return null
  const isHome = fx.teams?.home?.id === teamId
  const my = isHome ? hs : as
  const opp = isHome ? as : hs
  return my > opp ? 'G' : my === opp ? 'D' : 'M'
}
