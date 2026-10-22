// O'yin tafsilotlari — har bir o'yin uchun deterministik (seed bo'yicha) generatsiya.
import { MATCHES, LEAGUES } from './score.js'

const leagueById = Object.fromEntries(LEAGUES.map(l => [l.id, l]))

export const REFEREES = [
  'A. Hakamov',
  'B. Qodirov',
  "M. Turg'unov",
  'J. Oliver',
  'C. Rossi',
  'P. Garcia',
  'D. Müller',
  'S. Marciniak',
]

// Har o'yinga deterministik hakam
export function getMatchReferee(id) {
  let h = 2166136261
  const s = 'ref|' + id
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return REFEREES[(h >>> 0) % REFEREES.length]
}

// ---- seedlangan tasodifiy ----
function seedFrom(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return h >>> 0
}
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NAMES = [
  'Yusupov',
  'Karimov',
  'Silva',
  'Kane',
  'Saka',
  'Rice',
  'Foden',
  'Dias',
  'Stones',
  'Walker',
  'Odegaard',
  'Martinez',
  'Fernandez',
  'Palmer',
  'Jackson',
  'Caicedo',
  'Sterling',
  'Mount',
  'James',
  'Chilwell',
  'Havertz',
  'Gabriel',
  'White',
  'Partey',
  'Jesus',
  'Martinelli',
  'Trossard',
  'Zinchenko',
  'Rodri',
  'Bernardo',
  'Grealish',
  'Mendez',
  'Costa',
  'Ramos',
  'Toshmatov',
  'Aliev',
]
const POS = ['DG', 'HIM', 'HIM', 'HIM', 'HIM', 'YN', 'YN', 'YN', 'HJ', 'HJ', 'HJ']
const FORMATIONS = ['4-3-3', '4-2-3-1', '3-5-2', '4-4-2']

function pickNames(rng, count) {
  const pool = [...NAMES]
  const out = []
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng() * pool.length)
    out.push(pool.splice(idx, 1)[0])
  }
  return out
}

function buildLineup(rng) {
  const formation = FORMATIONS[Math.floor(rng() * FORMATIONS.length)]
  const lines = formation.split('-').map(Number) // himoya, yarim, hujum
  const names = pickNames(rng, 11)
  const numbers = [1]
  while (numbers.length < 11) {
    const n = 2 + Math.floor(rng() * 28)
    if (!numbers.includes(n)) numbers.push(n)
  }
  const players = names.map((name, i) => ({
    n: numbers[i],
    name,
    pos: i === 0 ? 'DG' : POS[i] || 'YN',
  }))
  return { formation, lines, players }
}

function genEvents(rng, hs, as) {
  const goals = []
  for (let i = 0; i < hs; i++) goals.push('home')
  for (let i = 0; i < as; i++) goals.push('away')
  // daqiqalar
  const used = new Set()
  const minute = () => {
    let m
    do {
      m = 1 + Math.floor(rng() * 90)
    } while (used.has(m))
    used.add(m)
    return m
  }
  const events = goals.map(team => ({
    min: minute(),
    team,
    type: 'goal',
    player: NAMES[Math.floor(rng() * NAMES.length)],
    assist: rng() > 0.45 ? NAMES[Math.floor(rng() * NAMES.length)] : null,
  }))
  // sariq kartalar
  const yellows = 1 + Math.floor(rng() * 3)
  for (let i = 0; i < yellows; i++) {
    events.push({
      min: minute(),
      team: rng() > 0.5 ? 'home' : 'away',
      type: 'yellow',
      player: NAMES[Math.floor(rng() * NAMES.length)],
    })
  }
  // ehtimoliy qizil
  if (rng() > 0.8) {
    events.push({
      min: minute(),
      team: rng() > 0.5 ? 'home' : 'away',
      type: 'red',
      player: NAMES[Math.floor(rng() * NAMES.length)],
    })
  }
  return events.sort((a, b) => a.min - b.min)
}

function genStats(rng, hs, as) {
  const posHome = 40 + Math.floor(rng() * 21) // 40..60
  const shotsHome = 7 + Math.floor(rng() * 12)
  const shotsAway = 7 + Math.floor(rng() * 12)
  const onHome = Math.max(hs, Math.floor(shotsHome * (0.3 + rng() * 0.3)))
  const onAway = Math.max(as, Math.floor(shotsAway * (0.3 + rng() * 0.3)))
  const xg = (g, on) => (g * 0.7 + on * 0.18 + rng() * 0.4).toFixed(2)
  return [
    { label: 'Ball egallash, %', home: posHome, away: 100 - posHome, bar: true },
    { label: 'Kutilgan gollar (xG)', home: xg(hs, onHome), away: xg(as, onAway), bar: false, num: true },
    { label: 'Zarbalar', home: shotsHome, away: shotsAway, bar: true },
    { label: 'Darvozaga zarba', home: onHome, away: onAway, bar: true },
    { label: 'Burchaklar', home: 2 + Math.floor(rng() * 8), away: 2 + Math.floor(rng() * 8), bar: true },
    { label: 'Qoidabuzarlik', home: 6 + Math.floor(rng() * 10), away: 6 + Math.floor(rng() * 10), bar: true },
    { label: 'Ofsaytlar', home: Math.floor(rng() * 5), away: Math.floor(rng() * 5), bar: true },
  ]
}

function genMomentum(rng) {
  return Array.from({ length: 38 }, () => Math.round((rng() - 0.5) * 100))
}

export function getMatchDetails(id) {
  const match = MATCHES.find(m => m.id === id)
  if (!match) return null
  const rng = mulberry32(seedFrom(id))
  const league = leagueById[match.leagueId]
  const played = match.status === 'live' || match.status === 'ft'
  const hs = played ? match.hs : 0
  const as = played ? match.as : 0

  // ovoz — koeffitsiyentdan
  const w = match.odds.map(o => 1 / o)
  const sum = w[0] + w[1] + w[2]
  const vote = {
    home: Math.round((w[0] / sum) * 100),
    draw: Math.round((w[1] / sum) * 100),
    away: Math.round((w[2] / sum) * 100),
  }

  return {
    match,
    league,
    played,
    events: played ? genEvents(rng, hs, as) : [],
    stats: played ? genStats(rng, hs, as) : [],
    vote,
    momentum: genMomentum(rng),
    lineups: { home: buildLineup(rng), away: buildLineup(rng) },
    venue: 'Markaziy stadion',
    referee: getMatchReferee(id),
  }
}
