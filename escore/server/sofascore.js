// SofaScore adapteri — FastAPI (sofascore-api, :8000) dan real ma'lumot olib,
// eSOCRE frontendi kutadigan shaklga aylantiradi.
//
// Nega FastAPI orqali? SofaScore 403 "challenge" anti-bot bilan himoyalangan;
// uni faqat curl_cffi (FastAPI tomonida) chetlab o'ta oladi. Node fetch to'g'ridan
// to'g'ri ulanolmaydi. Shu bois bu yerda localhost:8000 ga murojaat qilamiz.

import { translate, translateAll } from './translate.js'

// Render'da SCORE_API faqat hostname bo'lishi mumkin — protokol bo'lmasa https:// qo'shamiz.
const RAW_API = process.env.SCORE_API || 'http://localhost:8000'
const API = /^https?:\/\//.test(RAW_API) ? RAW_API : 'https://' + RAW_API

async function j(path) {
  const r = await fetch(API + path)
  if (!r.ok) throw new Error(`score-api ${r.status} ${path}`)
  return r.json()
}

// ---- yordamchilar ----

// Davlat/kategoriya → bayroq emoji (taxminiy; topilmasa umumiy belgi)
const FLAGS = {
  england: '🏴', scotland: '🏴', wales: '🏴', spain: '🇪🇸', italy: '🇮🇹',
  germany: '🇩🇪', france: '🇫🇷', netherlands: '🇳🇱', portugal: '🇵🇹',
  uzbekistan: '🇺🇿', usa: '🇺🇸', brazil: '🇧🇷', argentina: '🇦🇷', japan: '🇯🇵',
  'saudi arabia': '🇸🇦', turkey: '🇹🇷', belgium: '🇧🇪', mexico: '🇲🇽',
  international: '🌍', world: '🌍', europe: '🏆',
}
function flagFor(cat) {
  if (!cat) return '⚽'
  const key = (cat.name || cat.slug || cat.flag || '').toLowerCase()
  return FLAGS[key] || (cat.country?.alpha2 ? '🏳️' : '🏆')
}

function mapStatus(type) {
  if (type === 'inprogress') return 'live'
  if (type === 'finished') return 'ft'
  return 'sched' // notstarted, postponed, canceled, ...
}

function pad(n) { return String(n).padStart(2, '0') }
function timeStr(ts) {
  const d = new Date(ts * 1000)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function dateStr(ts) {
  const d = new Date(ts * 1000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Davlat alpha2 (FR, ES...) → bayroq emoji (regional indicator belgilaridan)
function flagEmoji(alpha2) {
  if (!alpha2 || alpha2.length !== 2) return '🏳️'
  const base = 0x1f1e6
  return String.fromCodePoint(...[...alpha2.toUpperCase()].map((c) => base + c.charCodeAt(0) - 65))
}
function ageFrom(ts) {
  if (!ts) return '—'
  return Math.floor((Date.now() / 1000 - ts) / (365.25 * 24 * 3600))
}
const FULL_MONTHS_UZ = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']
function birthUz(ts) {
  if (!ts) return null
  const d = new Date(ts * 1000)
  return `${d.getDate()} ${FULL_MONTHS_UZ[d.getMonth()]} ${d.getFullYear()}`
}
function followersText(n) {
  if (!n) return null
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return Math.round(n / 1e3) + 'k'
  return String(n)
}
function yearFrom(ts) {
  return ts ? new Date(ts * 1000).getFullYear() : '—'
}

// Jonli daqiqa — SofaScore period ma'lumotidan ANIQ hisoblanadi.
// time.currentPeriodStartTimestamp = joriy taym boshlangan vaqt;
// time.initial = taym boshidagi bazaviy soniya (1-taym 0, 2-taym 2700=45');
// time.max = taym chegarasi (1-taym 2700, 2-taym 5400). Tanaffus/qo'shimcha
// vaqtda chegarada (45'/90') to'xtab turamiz — startTimestamp'dan hisoblash
// tanaffusni xato qo'shib yuborardi.
function liveMinute(ev) {
  const t = ev.time || {}
  const now = Date.now() / 1000

  if (t.currentPeriodStartTimestamp && t.initial != null) {
    const secs = t.initial + (now - t.currentPeriodStartTimestamp)
    let mins = Math.floor(secs / 60) + 1
    if (t.max != null) {
      const maxMin = Math.floor(t.max / 60)
      if (mins > maxMin) mins = maxMin // 45+/90+ va tanaffus — chegarada turadi
    }
    return Math.max(1, mins)
  }

  // Zaxira (period ma'lumoti yo'q bo'lsa)
  let mins = Math.floor((now - ev.startTimestamp) / 60) + 1
  return Math.max(1, Math.min(mins, 90))
}

function teamObj(t) {
  return { n: t?.shortName || t?.name || '—', c: t?.teamColors?.primary || '#444', id: t?.id }
}

function mapMatch(ev, forcedDate) {
  const status = mapStatus(ev.status?.type)
  const ut = ev.tournament?.uniqueTournament || ev.tournament || {}
  const cat = ev.tournament?.category || ut.category || {}
  return {
    id: String(ev.id),
    date: forcedDate || dateStr(ev.startTimestamp),
    leagueId: String(ut.id || ev.tournament?.id || 'x'),
    league: {
      id: String(ut.id || ''),
      name: ut.name || ev.tournament?.name || 'Turnir',
      country: cat.name || '',
      flag: flagFor(cat),
    },
    time: timeStr(ev.startTimestamp),
    ts: ev.startTimestamp,
    status,
    minute: status === 'live' ? liveMinute(ev) : status === 'ft' ? 90 : undefined,
    home: teamObj(ev.homeTeam),
    away: teamObj(ev.awayTeam),
    hs: ev.homeScore?.current ?? 0,
    as: ev.awayScore?.current ?? 0,
  }
}

// Sana bo'yicha xom eventlar — scheduled-events ishlamasa (404), live'dan zaxira.
// SofaScore'ning scheduled-events/{date} endpointi vaqti-vaqti bilan 404 beradi;
// shunda hech bo'lmasa o'sha kundagi JONLI o'yinlar ko'rsatiladi.
async function eventsForDate(date) {
  try {
    const data = await j(`/events/date/${date}`)
    if (data.events?.length) return data.events
  } catch { /* scheduled-events ishlamadi */ }
  try {
    const live = await j('/events/live')
    return (live.events || []).filter((e) => dateStr(e.startTimestamp) === date)
  } catch { /* live ham ishlamadi */ }
  return []
}

// ---- O'yinlar (sana bo'yicha) ----
export async function matchesByDate(date) {
  const events = await eventsForDate(date)
  // turnir mashhurligi bo'yicha tartib (kattalari yuqorida)
  events.sort((a, b) => (b.tournament?.uniqueTournament?.userCount || 0) - (a.tournament?.uniqueTournament?.userCount || 0))
  return events.map((ev) => mapMatch(ev, date))
}

// ---- O'yin tafsiloti ----
const POS_MAP = { G: 'DG', D: 'HIM', M: 'YN', F: 'HJ' }

function mapIncidents(data) {
  const out = []
  for (const x of data.incidents || []) {
    if (x.incidentType === 'goal') {
      out.push({
        min: x.time, team: x.isHome ? 'home' : 'away', type: 'goal',
        player: x.player?.shortName || x.player?.name || '',
        assist: x.assist1?.shortName || x.assist1?.name || null,
      })
    } else if (x.incidentType === 'card') {
      const cls = (x.incidentClass || '').toLowerCase()
      const type = cls.includes('red') || cls === 'yellowred' ? 'red' : 'yellow'
      out.push({
        min: x.time, team: x.isHome ? 'home' : 'away', type,
        player: x.player?.shortName || x.playerName || '',
      })
    }
  }
  return out.sort((a, b) => a.min - b.min)
}

const STAT_KEYS = [
  'ballPossession', 'expectedGoals', 'totalShotsOnGoal', 'shotsOnGoal',
  'bigChanceCreated', 'cornerKicks', 'fouls', 'offsides', 'yellowCards',
]
function mapStats(data) {
  const all = (data.statistics || []).find((s) => s.period === 'ALL')
  if (!all) return []
  const items = []
  for (const g of all.groups || []) for (const it of g.statisticsItems || []) items.push(it)
  const byKey = Object.fromEntries(items.map((it) => [it.key, it]))
  const chosen = STAT_KEYS.map((k) => byKey[k]).filter(Boolean)
  const list = chosen.length >= 4 ? chosen : items.slice(0, 8)
  return list.map((it) => ({ label: it.name, home: String(it.home), away: String(it.away), bar: true }))
}

function mapSide(side) {
  if (!side) return { formation: '', lines: [], players: [] }
  const formation = side.formation || ''
  const lines = formation ? formation.split('-').map(Number) : []
  const starters = (side.players || []).filter((p) => !p.substitute)
  const players = starters.map((p) => ({
    id: p.player?.id,
    n: p.shirtNumber || p.jerseyNumber || p.player?.jerseyNumber || 0,
    name: p.player?.shortName || p.player?.name || '',
    pos: POS_MAP[p.player?.position] || p.player?.position || 'YN',
  }))
  return { formation, lines, players }
}

function mapGraph(data) {
  const pts = data.graphPoints || []
  if (!pts.length) return []
  const max = Math.max(1, ...pts.map((p) => Math.abs(p.value)))
  return pts.map((p) => Math.round((p.value / max) * 100))
}

function voteFrom(stats) {
  const xg = stats.find((s) => /expected goals/i.test(s.label))
  if (xg) {
    const hv = parseFloat(xg.home) || 0
    const av = parseFloat(xg.away) || 0
    const t = hv + av
    if (t > 0) {
      const home = Math.round((hv / t) * 60) + 13
      const away = Math.round((av / t) * 60) + 13
      return { home, draw: Math.max(8, 100 - home - away), away }
    }
  }
  return { home: 38, draw: 24, away: 38 }
}

export async function matchDetail(id) {
  const wrap = await j(`/events/${id}`)
  const event = wrap.event || wrap
  const match = mapMatch(event)
  const played = match.status !== 'sched'

  const [inc, st, lu, gr] = await Promise.allSettled([
    j(`/events/${id}/incidents`),
    j(`/events/${id}/statistics`),
    j(`/events/${id}/lineups`),
    j(`/events/${id}/graph`),
  ])

  const events = inc.status === 'fulfilled' ? mapIncidents(inc.value) : []
  const stats = st.status === 'fulfilled' ? mapStats(st.value) : []
  const lineups = lu.status === 'fulfilled'
    ? { home: mapSide(lu.value.home), away: mapSide(lu.value.away) }
    : { home: mapSide(null), away: mapSide(null) }
  const momentum = gr.status === 'fulfilled' ? mapGraph(gr.value) : []

  return {
    match,
    league: match.league,
    played,
    events,
    stats,
    vote: voteFrom(stats),
    momentum,
    lineups,
    venue: event.venue?.stadium?.name || event.venue?.name || '—',
    referee: event.referee?.name || '—',
    refereeId: event.referee?.id || null,
  }
}

// ---- Dominant turnir (bugungi o'yinlardan eng mashhuri) ----
async function dominantTournament(date) {
  const events = await eventsForDate(date)
  const byT = new Map()
  for (const ev of events) {
    const ut = ev.tournament?.uniqueTournament
    if (!ut?.id || !ev.season?.id) continue
    const k = ut.id
    if (!byT.has(k)) byT.set(k, { tid: ut.id, sid: ev.season.id, count: 0, pop: ut.userCount || 0 })
    byT.get(k).count++
  }
  const best = [...byT.values()].sort((a, b) => b.pop - a.pop || b.count - a.count)[0]
  if (!best) throw new Error('dominant turnir topilmadi')
  return best
}

// ---- Bombardirlar (dominant turnir) ----
export async function scorers(date) {
  const { tid, sid } = await dominantTournament(date)
  const data = await j(`/tournaments/${tid}/season/${sid}/top-players/overall`)
  const goals = data.topPlayers?.goals || []
  return goals.slice(0, 6).map((g, i) => ({
    rank: i + 1,
    id: g.player?.id,
    teamId: g.team?.id,
    name: g.player?.shortName || g.player?.name || '',
    team: g.team?.shortName || g.team?.name || '',
    goals: g.statistics?.goals ?? 0,
    c: g.team?.teamColors?.primary || '#444',
  }))
}

// ---- Mini jadval (top-5) ----
export async function standingsMini(date) {
  const { tid, sid } = await dominantTournament(date)
  const data = await j(`/tournaments/${tid}/season/${sid}/standings`)
  const rows = data.standings?.[0]?.rows || []
  return rows.slice(0, 5).map((r) => ({
    pos: r.position,
    club: r.team?.shortName || r.team?.name || '',
    pts: r.points,
  }))
}

// ---- Liga sahifasi (jadval + o'yinlar + bombardirlar) ----
function splitRec(r) {
  return { w: r.wins || 0, d: r.draws || 0, l: r.losses || 0 }
}

// Bosqich nomlari (knockout) o'zbekcha qisqa belgilar
const STAGE_UZ = {
  'round-of-32': '1/16',
  'round-of-16': '1/8',
  quarterfinals: '1/4',
  semifinals: '1/2',
  'match-for-3rd-place': '3-o\'rin',
  final: 'Final',
}

// Turnir bosqichlari progress chizig'i (faqat kubok — nomli knockout roundlari bo'lsa)
function buildStages(roundsData) {
  const rounds = roundsData?.rounds || []
  const named = rounds.filter((r) => r.name)
  if (!named.length) return null // oddiy liga — bosqich yo'q
  const current = roundsData?.currentRound?.round
  const groupRounds = rounds.filter((r) => !r.name).map((r) => r.round)

  const stages = []
  if (groupRounds.length) stages.push({ name: 'Guruh', rounds: groupRounds })
  for (const r of named) stages.push({ name: STAGE_UZ[r.slug] || r.name, rounds: [r.round] })

  let curIdx = -1
  stages.forEach((s, i) => { if (s.rounds.includes(current)) curIdx = i })

  return stages.map((s, i) => ({
    name: s.name,
    done: curIdx >= 0 && i < curIdx,
    current: i === curIdx,
  }))
}

export async function league(id, seasonId) {
  const seasonsRes = await j(`/tournaments/${id}/seasons`)
  const seasonList = (seasonsRes.seasons || []).map((s) => ({ id: s.id, year: s.year }))
  const sid = seasonId || seasonList[0]?.id
  const tour = await j(`/tournaments/${id}`)
  const ut = tour.uniqueTournament || {}

  const [total, home, away, roundsR] = await Promise.allSettled([
    j(`/tournaments/${id}/season/${sid}/standings`),
    j(`/tournaments/${id}/season/${sid}/standings/home`),
    j(`/tournaments/${id}/season/${sid}/standings/away`),
    j(`/tournaments/${id}/season/${sid}/rounds`),
  ])
  const stages = roundsR.status === 'fulfilled' ? buildStages(roundsR.value) : null
  // uy/mehmon bo'linishini BARCHA guruhlardan yig'amiz (jamoa id bo'yicha)
  const homeById = {}
  const awayById = {}
  if (home.status === 'fulfilled')
    for (const g of home.value.standings || [])
      for (const r of g.rows || []) homeById[r.team.id] = splitRec(r)
  if (away.status === 'fulfilled')
    for (const g of away.value.standings || [])
      for (const r of g.rows || []) awayById[r.team.id] = splitRec(r)

  const mapRow = (r) => ({
    id: r.team?.id,
    pos: r.position,
    name: r.team?.shortName || r.team?.name || '',
    c: r.team?.teamColors?.primary || '#444',
    P: r.matches ?? 0,
    Pts: r.points ?? 0,
    total: splitRec(r),
    home: homeById[r.team.id] || splitRec(r),
    away: awayById[r.team.id] || { w: 0, d: 0, l: 0 },
    GF: r.scoresFor ?? 0,
    GA: r.scoresAgainst ?? 0,
    GD: (r.scoresFor ?? 0) - (r.scoresAgainst ?? 0),
    form: [],
  })

  // BARCHA guruhlar (A, B, C ... — Jahon chempionatida 12 guruh)
  const allGroups = total.status === 'fulfilled' ? (total.value.standings || []) : []
  const groups = allGroups.map((g) => ({
    name: g.name || g.tournament?.name || 'Jadval',
    rows: (g.rows || []).map(mapRow),
  }))
  const rows = groups[0]?.rows || [] // moslik uchun (Team.jsx jadval tabi)

  // o'yinlar (o'tgan + kelajak)
  let matches = []
  try {
    const [last, next] = await Promise.allSettled([
      j(`/tournaments/${id}/season/${sid}/events/last`),
      j(`/tournaments/${id}/season/${sid}/events/next`),
    ])
    const evs = []
    if (last.status === 'fulfilled') evs.push(...(last.value.events || []))
    if (next.status === 'fulfilled') evs.push(...(next.value.events || []))
    matches = evs.map((ev) => mapMatch(ev))
  } catch { /* ignore */ }

  // bombardirlar
  let scorersList = []
  try {
    const tp = await j(`/tournaments/${id}/season/${sid}/top-players/overall`)
    scorersList = (tp.topPlayers?.goals || []).slice(0, 10).map((g, i) => ({
      rank: i + 1,
      id: g.player?.id,
      teamId: g.team?.id,
      name: g.player?.shortName || g.player?.name || '',
      team: g.team?.shortName || g.team?.name || '',
      c: g.team?.teamColors?.primary || '#444',
      goals: g.statistics?.goals ?? 0,
      assists: g.statistics?.assists ?? 0,
    }))
  } catch { /* ignore */ }

  return {
    league: { id: String(id), name: ut.name || 'Liga', country: ut.category?.name || '', flag: flagFor(ut.category) },
    seasons: seasonList,
    currentSeasonId: sid,
    stages,
    teamCount: groups.reduce((n, g) => n + g.rows.length, 0),
    groups,
    rows,
    matches,
    scorers: scorersList,
  }
}

// ---- Jamoa sahifasi (real) ----
const SQUAD_GROUPS = { G: 'Darvozabonlar', D: 'Himoyachilar', M: 'Yarim himoyachilar', F: 'Hujumchilar' }
const SQUAD_ORDER = ['G', 'D', 'M', 'F']

export async function team(id) {
  const [td, sq, last, next] = await Promise.allSettled([
    j(`/teams/${id}`),
    j(`/teams/${id}/players`),
    j(`/teams/${id}/events/last`),
    j(`/teams/${id}/events/next`),
  ])
  const t = td.status === 'fulfilled' ? td.value.team : null
  if (!t) throw new Error('team topilmadi')
  const ut = t.primaryUniqueTournament || t.tournament?.uniqueTournament || {}

  // sostav — pozitsiya bo'yicha guruhlash
  const buckets = { G: [], D: [], M: [], F: [] }
  const players = sq.status === 'fulfilled' ? (sq.value.players || []) : []
  for (const e of players) {
    const p = e.player
    const pos = p.position || 'M'
    if (!buckets[pos]) buckets[pos] = []
    buckets[pos].push({
      id: p.id,
      n: p.jerseyNumber || '',
      flag: flagEmoji(p.country?.alpha2),
      name: p.shortName || p.name,
      pos,
      age: ageFrom(p.dateOfBirthTimestamp),
    })
  }
  const squad = SQUAD_ORDER.filter((k) => buckets[k]?.length).map((k) => ({
    label: SQUAD_GROUPS[k], players: buckets[k],
  }))

  // o'yinlar (o'tgan + kelajak), eng yangisi tepada
  const lastEvs = last.status === 'fulfilled' ? (last.value.events || []) : []
  const nextEvs = next.status === 'fulfilled' ? (next.value.events || []) : []
  const matches = [...lastEvs, ...nextEvs]
    .sort((a, b) => b.startTimestamp - a.startTimestamp)
    .map((ev) => mapMatch(ev))

  // forma — oxirgi 5 tugagan o'yindan
  const form = lastEvs
    .filter((e) => e.status?.type === 'finished')
    .slice(-5)
    .map((e) => {
      const isHome = e.homeTeam.id === t.id
      const my = isHome ? e.homeScore.current : e.awayScore.current
      const opp = isHome ? e.awayScore.current : e.homeScore.current
      return my > opp ? 'G' : my === opp ? 'D' : 'M'
    })

  return {
    name: t.name,
    id: t.id,
    color: t.teamColors?.primary || '#444',
    country: t.country?.name || ut.category?.name || '',
    standing: null,
    leagueId: String(ut.id || ''),
    league: { flag: flagFor(ut.category), name: ut.name || 'Turnir' },
    info: {
      stadium: t.venue?.stadium?.name || '—',
      city: t.venue?.city?.name || '—',
      coach: t.manager?.name || '—',
      coachId: t.manager?.id || null,
      founded: yearFrom(t.foundationDateTimestamp),
    },
    form,
    squad,
    matches,
  }
}

// ---- O'yinchi sahifasi (real) ----
const POS_LABEL = { G: 'Darvozabon', D: 'Himoyachi', M: 'Yarim himoyachi', F: 'Hujumchi' }
const MONTHS_UZ = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek']

// O'yinchi qaysi tomonda o'ynagan (klub yoki milliy jamoa)
function playerSide(ev, clubId, countryName) {
  if (ev.homeTeam?.id === clubId) return 'home'
  if (ev.awayTeam?.id === clubId) return 'away'
  if (ev.homeTeam?.national && ev.homeTeam?.country?.name === countryName) return 'home'
  if (ev.awayTeam?.national && ev.awayTeam?.country?.name === countryName) return 'away'
  return null
}
// O'yinchi nuqtai nazaridan natija: G' (g'alaba) / D (durang) / M (mag'lubiyat)
function matchResult(ev, side) {
  const w = ev.winnerCode
  if (!w || !side) return null
  if (w === 3) return 'D'
  return (side === 'home' && w === 1) || (side === 'away' && w === 2) ? 'G' : 'M'
}
function dayKey(ts) { return Math.floor(ts / 86400) }

// So'nggi 12 oy — oylik o'rtacha reyting (last-year-summary'dan)
function monthlyRatings(summary) {
  const events = (summary || []).filter((e) => e.type === 'event' && e.value)
  const byMonth = {}
  for (const e of events) {
    const d = new Date(e.timestamp * 1000)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    if (!byMonth[key]) byMonth[key] = { sum: 0, n: 0 }
    byMonth[key].sum += parseFloat(e.value)
    byMonth[key].n++
  }
  const now = new Date()
  const out = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const b = byMonth[`${d.getFullYear()}-${d.getMonth()}`]
    out.push({ label: MONTHS_UZ[d.getMonth()], rating: b ? +(b.sum / b.n).toFixed(1) : null })
  }
  return out
}

export async function player(id) {
  const pd = await j(`/players/${id}`)
  const p = pd.player
  if (!p) throw new Error('player topilmadi')

  const [ao, seasons, last, lyr] = await Promise.allSettled([
    j(`/players/${id}/attribute-overviews`),
    j(`/players/${id}/statistics/seasons`),
    j(`/players/${id}/events/last`),
    j(`/players/${id}/last-year-summary`),
  ])

  // so'nggi 12 oy oylik reyting
  const monthly = lyr.status === 'fulfilled' ? monthlyRatings(lyr.value.summary) : []

  // radar atributlari
  let attrs = [
    { label: 'Hujum', val: 0 }, { label: 'Texnika', val: 0 },
    { label: 'Taktika', val: 0 }, { label: 'Himoya', val: 0 }, { label: 'Ijod', val: 0 },
  ]
  if (ao.status === 'fulfilled') {
    const a = ao.value.playerAttributeOverviews?.[0] || ao.value.averageAttributeOverviews?.[0]
    if (a) attrs = [
      { label: 'Hujum', val: a.attacking || 0 },
      { label: 'Texnika', val: a.technical || 0 },
      { label: 'Taktika', val: a.tactical || 0 },
      { label: 'Himoya', val: a.defending || 0 },
      { label: 'Ijod', val: a.creativity || 0 },
    ]
  }
  const sorted = [...attrs].sort((a, b) => b.val - a.val)

  // mavsumiy statistika + reyting
  let overall = '—', rating = '—', statRows = [], seasonSummary = null
  // o'yinchi o'ynagan ligalar ro'yxati (dropdown uchun — har turnir + so'nggi mavsumi)
  const seasonsList = seasons.status === 'fulfilled'
    ? (seasons.value.uniqueTournamentSeasons || [])
        .map((u) => ({ tid: u.uniqueTournament.id, sid: u.seasons?.[0]?.id, name: u.uniqueTournament.name, year: u.seasons?.[0]?.year }))
        .filter((x) => x.sid)
    : []
  if (seasons.status === 'fulfilled') {
    const uts = seasons.value.uniqueTournamentSeasons?.[0]
    if (uts?.seasons?.length) {
      const tid = uts.uniqueTournament.id, sid = uts.seasons[0].id
      try {
        const [ss, hmRes] = await Promise.all([
          j(`/players/${id}/statistics/${tid}/${sid}`),
          j(`/players/${id}/heatmap/${tid}/${sid}`).catch(() => null),
        ])
        const s = ss.statistics || {}
        rating = s.rating ? (+s.rating).toFixed(2) : '—'
        overall = rating
        const apps = s.appearances ?? 0
        const isGK = p.position === 'G'
        seasonSummary = {
          tournament: uts.uniqueTournament.name,
          tournamentId: tid,
          season: uts.seasons[0].year,
          heatmap: hmRes?.points || [],
          rating,
          appearances: apps,
          started: s.matchesStarted ?? 0,
          minutesPerGame: apps ? Math.round((s.minutesPlayed || 0) / apps) : 0,
          totalMinutes: s.minutesPlayed ?? 0,
          isGK,
          goals: s.goals ?? 0,
          assists: s.assists ?? 0,
          saves: s.saves ?? 0,
          cleanSheet: s.cleanSheet ?? 0,
          goalsConceded: s.goalsConceded ?? 0,
        }
        statRows = [
          { group: `${uts.uniqueTournament.name} ${uts.seasons[0].year}`, rows: [
            ['O\'yinlar', s.appearances ?? 0], ['Daqiqalar', s.minutesPlayed ?? 0], ['Reyting', rating],
          ] },
          { group: 'Hujum', rows: [
            ['Gollar', s.goals ?? 0], ['Assistlar', s.assists ?? 0], ['Zarbalar', s.totalShots ?? 0],
          ] },
          { group: 'Aniqlik / Himoya', rows: [
            ['Uzatmalar', s.totalPasses ?? 0],
            ['Aniq uzatma %', s.accuratePassesPercentage ? Math.round(s.accuratePassesPercentage) + '%' : '—'],
            ['Tortib olishlar', s.tackles ?? 0],
          ] },
        ]
      } catch { /* statistika yo'q */ }
    }
  }

  // last-year-summary'dan kun→reyting xaritasi (o'yinga reyting biriktirish uchun)
  const ratingByDay = {}
  if (lyr.status === 'fulfilled') {
    for (const e of lyr.value.summary || []) {
      if (e.type === 'event' && e.value) ratingByDay[dayKey(e.timestamp)] = e.value
    }
  }

  // so'nggi o'yinlar (natija + reyting bilan)
  let recent = []
  if (last.status === 'fulfilled') {
    const clubId = p.team?.id
    const cName = p.country?.name
    recent = (last.value.events || []).slice(-15).reverse().map((ev) => {
      const side = playerSide(ev, clubId, cName)
      return {
        m: mapMatch(ev),
        isHome: side === 'home' || (side === null && ev.homeTeam?.id === clubId),
        result: matchResult(ev, side),
        rating: ratingByDay[dayKey(ev.startTimestamp)] || null,
      }
    })
  }

  // bozor qiymati matni (235K, 12.5 mln va h.k.)
  const rawVal = p.proposedMarketValueRaw?.value || 0
  const valueText = rawVal >= 1e6
    ? (rawVal / 1e6).toFixed(rawVal >= 1e7 ? 0 : 1) + ' mln €'
    : rawVal >= 1e3 ? Math.round(rawVal / 1e3) + ' ming €'
      : rawVal ? rawVal + ' €' : '—'

  return {
    name: p.name,
    id: p.id,
    team: p.team?.name || '—',
    teamId: p.team?.id || null,
    teamColor: p.team?.teamColors?.primary || '#444',
    posLabel: POS_LABEL[p.position] || p.position || '',
    overall, rating,
    value: rawVal ? Math.round(rawVal / 1e6) : '—',
    valueText,
    monthly,
    seasonSummary,
    seasonsList,
    followers: followersText(p.userCount),
    base: {
      number: p.jerseyNumber || '—',
      flag: flagEmoji(p.country?.alpha2),
      country: p.country?.name || '—',
      age: ageFrom(p.dateOfBirthTimestamp),
      birth: birthUz(p.dateOfBirthTimestamp),
      height: p.height || '—',
      foot: p.preferredFoot || '—',
    },
    attrs,
    strengths: sorted.slice(0, 2).map((a) => a.label),
    weaknesses: sorted.slice(-2).map((a) => a.label),
    stats: statRows,
    recent,
  }
}

// ---- O'yinchi karerasi (mavsumma-mavsum jadval) ----
export async function playerCareer(id) {
  const pd = await j(`/players/${id}`)
  const isGK = pd.player?.position === 'G'
  const seas = await j(`/players/${id}/statistics/seasons`)
  const uts = seas.uniqueTournamentSeasons || []

  const tasks = []
  for (const u of uts) {
    for (const s of u.seasons || []) {
      tasks.push({ tid: u.uniqueTournament.id, sid: s.id, tName: u.uniqueTournament.name, year: s.year, teamId: u.team?.id })
    }
  }
  const limited = tasks.slice(0, 16) // API chaqiruvlarini cheklash

  const results = await Promise.allSettled(
    limited.map((t) => j(`/players/${id}/statistics/${t.tid}/${t.sid}`).then((r) => ({ ...t, s: r.statistics || {} })))
  )
  const rows = results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value)
    .map(({ tName, year, teamId, s }) => ({
      year, tournament: tName, teamId,
      mp: s.appearances ?? 0,
      min: s.minutesPlayed ?? 0,
      rating: s.rating ? (+s.rating).toFixed(2) : '—',
      cls: s.cleanSheet ?? 0,
      gc: s.goalsConceded ?? 0,
      goals: s.goals ?? 0,
      assists: s.assists ?? 0,
    }))
    .filter((r) => r.mp > 0)
    .sort((a, b) => String(b.year).localeCompare(String(a.year)))

  return { isGK, rows }
}

// ---- O'yinchining tanlangan ligadagi mavsumi (statistika + heatmap + reyting tasmasi) ----
export async function playerSeason(id, tid, sid) {
  const pd = await j(`/players/${id}`)
  const p = pd.player
  const isGK = p?.position === 'G'

  const [statRes, hmRes, lyrRes, ev0, ev1, ev2] = await Promise.allSettled([
    j(`/players/${id}/statistics/${tid}/${sid}`),
    j(`/players/${id}/heatmap/${tid}/${sid}`),
    j(`/players/${id}/last-year-summary`),
    j(`/players/${id}/events/last?page=0`),
    j(`/players/${id}/events/last?page=1`),
    j(`/players/${id}/events/last?page=2`),
  ])

  const s = statRes.status === 'fulfilled' ? (statRes.value.statistics || {}) : {}
  const apps = s.appearances ?? 0
  const summary = {
    rating: s.rating ? (+s.rating).toFixed(2) : '—',
    appearances: apps, started: s.matchesStarted ?? 0,
    minutesPerGame: apps ? Math.round((s.minutesPlayed || 0) / apps) : 0,
    totalMinutes: s.minutesPlayed ?? 0,
    isGK, goals: s.goals ?? 0, assists: s.assists ?? 0,
    saves: s.saves ?? 0, cleanSheet: s.cleanSheet ?? 0, goalsConceded: s.goalsConceded ?? 0,
  }

  const heatmap = hmRes.status === 'fulfilled' ? (hmRes.value.points || []) : []

  // reyting tasmasi: last-year-summary'dan shu turnir reytinglari + raqib (events'dan kun bo'yicha)
  const ratingByDay = {}
  if (lyrRes.status === 'fulfilled') {
    for (const e of lyrRes.value.summary || []) {
      if (e.type === 'event' && e.value && String(e.uniqueTournamentId) === String(tid)) {
        ratingByDay[dayKey(e.timestamp)] = e.value
      }
    }
  }
  const evByDay = {}
  for (const er of [ev0, ev1, ev2]) {
    if (er.status === 'fulfilled') {
      for (const ev of er.value.events || []) evByDay[dayKey(ev.startTimestamp)] = ev
    }
  }
  const clubId = p?.team?.id, cName = p?.country?.name
  const timeline = Object.keys(ratingByDay).map(Number).sort((a, b) => a - b).map((d) => {
    const ev = evByDay[d]
    const rating = ratingByDay[d]
    if (ev) {
      const side = playerSide(ev, clubId, cName)
      const opp = side === 'home' ? ev.awayTeam : ev.homeTeam
      return {
        date: dateStr(ev.startTimestamp), matchId: String(ev.id),
        oppName: opp?.shortName || opp?.name, oppId: opp?.id, oppColor: opp?.teamColors?.primary || '#444',
        rating,
      }
    }
    return { date: null, oppName: null, rating }
  })

  return { summary, heatmap, timeline }
}

// ---- Murabbiy sahifasi (real) ----
export async function coach(id) {
  const md = await j(`/managers/${id}`)
  const m = md.manager
  if (!m) throw new Error('manager topilmadi')
  const perf = m.performance || {}
  const total = perf.total || 0
  const w = perf.wins || 0, d = perf.draws || 0, l = perf.losses || 0
  const ppg = total ? (perf.totalPoints / total).toFixed(2) : '0'
  const winPct = total ? Math.round((w / total) * 100) : 0

  let matches = []
  try {
    const lastEv = await j(`/managers/${id}/events/last`)
    matches = (lastEv.events || []).map((ev) => mapMatch(ev)).reverse()
  } catch { /* yo'q */ }

  const career = (m.teams || []).map((tm) => ({
    club: tm.name, id: tm.id, c: tm.teamColors?.primary || '#444',
    from: '', to: '', games: '—', ppg: '—', trophies: 0,
  }))

  return {
    name: m.name,
    id: m.id,
    team: m.team?.name || m.teams?.[0]?.name || '—',
    teamId: m.team?.id || m.teams?.[0]?.id || null,
    teamColor: m.team?.teamColors?.primary || '#444',
    flag: flagEmoji(m.country?.alpha2 || m.nationalityISO2),
    country: m.country?.name || m.nationality || '—',
    age: ageFrom(m.dateOfBirthTimestamp),
    formation: m.preferredFormation || '—',
    totalGames: total,
    totalTrophies: 0,
    record: { games: total, w, d, l, ppg, winPct },
    career,
    matches,
  }
}

// ---- Hakam sahifasi (real) ----
export async function referee(id) {
  const rd = await j(`/referees/${id}`)
  const r = rd.referee
  if (!r) throw new Error('referee topilmadi')
  const apps = r.games || 0
  const yellow = r.yellowCards || 0
  const red = (r.redCards || 0) + (r.yellowRedCards || 0)
  const flag = flagEmoji(r.country?.alpha2)

  let matches = []
  try {
    const lastEv = await j(`/referees/${id}/events/last`)
    matches = (lastEv.events || []).map((ev) => mapMatch(ev)).reverse()
  } catch { /* yo'q */ }

  return {
    name: r.name,
    id: r.id,
    flag,
    country: r.country?.name || '—',
    age: ageFrom(r.dateOfBirthTimestamp),
    totals: { apps, yellow, red, pen: 0 },
    career: [{
      id: 0, flag, name: 'Umumiy karyera',
      apps, avgYellow: apps ? (yellow / apps).toFixed(2) : '0', red, pen: 0,
    }],
    matches,
  }
}

// ---- Yangiliklar (sofascore.com/news tahririyat maqolalari, o'zbekchaga tarjima) ----
function relativeFromDate(iso) {
  const ts = Math.floor(new Date(iso).getTime() / 1000)
  if (!ts) return ''
  const diff = Math.abs(Math.floor(Date.now() / 1000 - ts))
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))} daqiqa oldin`
  if (diff < 86400) return `${Math.floor(diff / 3600)} soat oldin`
  return `${Math.floor(diff / 86400)} kun oldin`
}

const CAT_LABELS = {
  'world-cup': 'Jahon chempionati',
  'champions-league': 'Chempionlar ligasi',
  'europa-league': 'Yevropa ligasi',
  'premier-league': 'Premyer-liga',
  'la-liga': 'La Liga',
  'serie-a': 'Seriya A',
  bundesliga: 'Bundesliga',
  transfers: 'Transfer',
  transfer: 'Transfer',
  fantasy: 'Fantasy',
  football: 'Futbol',
}
function catLabel(cats) {
  for (const c of cats || []) if (CAT_LABELS[c] && c !== 'football' && c !== 'sport') return CAT_LABELS[c]
  return 'Futbol'
}

export async function news() {
  // sofascore.com/news dan futbol maqolalarini olamiz (FastAPI HTML ni parse qiladi)
  const data = await j('/news')
  const posts = (data.posts || [])
    .filter((p) => p.section === 'football' && p.image && p.title)
    .slice(0, 18)

  // sarlavha + excerptni o'zbekchaga tarjima (parallel)
  const titles = await translateAll(posts.map((p) => p.title))
  const subs = await translateAll(posts.map((p) => p.excerpt))

  return posts.map((p, i) => ({
    id: p.id,
    slug: p.slug,
    title: titles[i] || p.title,
    subtitle: subs[i] || p.excerpt,
    image: p.image,
    url: p.url,
    isVideo: false,
    league: catLabel(p.categories),
    source: 'SofaScore',
    date: p.date,
    time: relativeFromDate(p.date),
  }))
}

// ---- Bitta maqola (to'liq matn, o'zbekchaga tarjima) ----
export async function article(slug) {
  const a = await j(`/news/${encodeURIComponent(slug)}`)
  // sarlavha + qisqacha + barcha bloklar matnini parallel tarjima qilamiz
  const texts = [a.title, a.excerpt, ...(a.blocks || []).map((b) => b.text)]
  const tr = await translateAll(texts)
  const title = tr[0] || a.title
  const excerpt = tr[1] || a.excerpt
  const blocks = (a.blocks || []).map((b, i) => ({ type: b.type, text: tr[i + 2] || b.text }))
  return {
    id: a.id,
    slug: a.slug,
    title,
    excerpt,
    image: a.image,
    author: a.author,
    league: catLabel(a.categories),
    date: a.date,
    time: relativeFromDate(a.date),
    blocks,
    sourceUrl: a.url,
  }
}

// ---- Bosh sahifa (gazeta) — real yangiliklar + jadval + natija + fikstura ----
async function homeStandings(date, n = 6) {
  try {
    const { tid, sid } = await dominantTournament(date)
    const data = await j(`/tournaments/${tid}/season/${sid}/standings`)
    const rows = data.standings?.[0]?.rows || []
    return rows.slice(0, n).map((r) => ({
      pos: r.position,
      club: r.team?.shortName || r.team?.name || '',
      p: r.matches ?? 0, w: r.wins ?? 0, d: r.draws ?? 0, l: r.losses ?? 0,
      pts: r.points ?? 0,
    }))
  } catch { return [] }
}

export async function home() {
  const date = days().today
  const [newsRes, matchesRes, standRes] = await Promise.allSettled([
    news(),
    matchesByDate(date),
    homeStandings(date),
  ])
  const articles = newsRes.status === 'fulfilled' ? newsRes.value : []
  const matches = matchesRes.status === 'fulfilled' ? matchesRes.value : []
  const standings = standRes.status === 'fulfilled' ? standRes.value : []

  const finished = matches.filter((m) => m.status === 'ft').slice(0, 6)
  const upcoming = matches.filter((m) => m.status === 'sched').slice(0, 6)

  // Maqolani gazeta blokiga aylantiramiz (ICHKI havola + rasm)
  const toStory = (a) => ({
    slug: a.slug, href: `/news/${a.slug}`, image: a.image,
    kicker: a.league, title: a.title, standfirst: a.subtitle,
  })

  const lead = articles[0]
    ? { ...toStory(articles[0]), photoTag: articles[0].league, caption: articles[0].subtitle, body: [articles[0].subtitle] }
    : null

  return {
    lead,
    secondary: articles.slice(1, 4).map(toStory),
    columns: articles.slice(4, 7).map((a) => ({ ...toStory(a), author: a.source || 'SofaScore' })),
    briefs: articles.slice(7, 12).map((a) => a.title),
    ticker: articles.slice(0, 8).map((a) => a.title),
    standings,
    results: finished.map((m) => ({ home: m.home.n, hs: m.hs, as: m.as, away: m.away.n })),
    fixtures: upcoming.map((m) => ({ time: m.time, ts: m.ts, home: m.home.n, away: m.away.n })),
  }
}

// ---- Davlatlar (kategoriyalar) ----
export async function countries() {
  const data = await j('/categories')
  return (data.categories || [])
    .filter((c) => c.name)
    .map((c) => ({ id: c.id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// ---- Bitta davlatning ligalari ----
export async function countryLeagues(id) {
  const data = await j(`/category/${id}/tournaments`)
  const out = []
  for (const g of data.groups || [])
    for (const u of g.uniqueTournaments || []) out.push({ id: u.id, name: u.name })
  return out
}

// ---- Reyting (FIFA / UEFA) ----
export async function rankings(kind) {
  const typeId = kind === 'uefa' ? 1 : 2
  const data = await j(`/rankings/${typeId}`)
  const rows = data.rankings || []
  return rows.slice(0, 60).map((r) => ({
    rank: r.ranking,
    name: r.team?.name || r.team?.country?.name || r.name || r.rowName || '—',
    teamId: r.team?.id,
    points: Math.round(r.points || r.totalPoints || 0),
    prev: r.previousRanking ?? null,
  }))
}

// ---- Rasm proksisi (FastAPI :8000 dan binary olib uzatish) ----
export async function fetchImage(kind, id) {
  const r = await fetch(`${API}/images/${kind}/${id}`)
  if (!r.ok) throw new Error(`img ${r.status}`)
  return {
    buf: Buffer.from(await r.arrayBuffer()),
    type: r.headers.get('content-type') || 'image/png',
  }
}

// ---- Dinamik kun tasmasi (bugun ± 2) ----
const DOW = ['YAK', 'DUSH', 'SESH', 'CHOR', 'PAY', 'JUM', 'SHA']
const DOW_LABEL = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba']
export function days() {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  const list = []
  for (let off = -2; off <= 2; off++) {
    const d = new Date(today)
    d.setDate(today.getDate() + off)
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    list.push({
      date,
      dow: DOW[d.getDay()],
      d: pad(d.getDate()),
      label: off === 0 ? 'Bugun' : DOW_LABEL[d.getDay()],
    })
  }
  return { today: todayStr, days: list }
}
