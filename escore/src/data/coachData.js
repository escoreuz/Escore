// Murabbiy sahifasi — faoliyat ko'rsatkichi, karyera tarixi, o'yinlar. Seedlangan.
import { MATCHES } from './score.js'
import { colorOf, teamPrimaryLeague, getLeagueTable } from './leagueData.js'

function seedFrom(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return h >>> 0
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FLAGS = ['🇮🇹', '🇪🇸', '🇩🇪', '🇫🇷', '🏴', '🇵🇹', '🇦🇷', '🇳🇱', '🇺🇿', '🇭🇷']
const FLAG_COUNTRY = {
  '🇮🇹': 'Italiya', '🇪🇸': 'Ispaniya', '🇩🇪': 'Germaniya', '🇫🇷': 'Fransiya',
  '🏴': 'Angliya', '🇵🇹': 'Portugaliya', '🇦🇷': 'Argentina', '🇳🇱': 'Niderlandiya',
  '🇺🇿': 'O\'zbekiston', '🇭🇷': 'Xorvatiya',
}
const FORMATIONS = ['4-3-3', '4-2-3-1', '3-5-2', '4-4-2', '3-4-3']

// Mashhur murabbiylar uchun aniq fuqarolik (jamoa sahifalaridagi KNOWN.coach bilan mos)
const KNOWN = {
  'C. Ancelotti': { flag: '🇮🇹', age: 65 },
  'H. Flick': { flag: '🇩🇪', age: 60 },
  'M. Arteta': { flag: '🇪🇸', age: 43 },
  'E. Maresca': { flag: '🇮🇹', age: 45 },
  'A. Slot': { flag: '🇳🇱', age: 46 },
  'P. Guardiola': { flag: '🇪🇸', age: 54 },
  'R. Amorim': { flag: '🇵🇹', age: 40 },
  'S. Inzaghi': { flag: '🇮🇹', age: 49 },
  'P. Fonseca': { flag: '🇵🇹', age: 52 },
  'T. Motta': { flag: '🇮🇹', age: 43 },
  'V. Kompany': { flag: '🇧🇪', age: 39 },
  'L. Enrique': { flag: '🇪🇸', age: 55 },
}

const CAREER_CLUBS = ['Parma', 'Juventus', 'Milan', 'Chelsea', 'PSG', 'Real Madrid', 'Bayern', 'Napoli', 'Everton', 'Roma', 'Sevilla', 'Valencia', 'Porto', 'Ajax', 'Lyon']

export function getCoach(team, name) {
  const leagueId = teamPrimaryLeague(team)
  const rng = mulberry32(seedFrom('coach|' + name))
  const known = KNOWN[name]
  const flag = known?.flag || FLAGS[Math.floor(rng() * FLAGS.length)]
  const age = known?.age || 45 + Math.floor(rng() * 22)
  const formation = FORMATIONS[Math.floor(rng() * FORMATIONS.length)]

  // joriy mavsum ko'rsatkichi — jamoa jadvalidan
  let w = 18, d = 8, l = 6
  if (leagueId) {
    const row = getLeagueTable(leagueId).rows.find((r) => r.name === team)
    if (row) { w = row.total.w; d = row.total.d; l = row.total.l }
  }
  const games = w + d + l
  const ppg = (((w * 3 + d) / Math.max(1, games))).toFixed(2)
  const winPct = Math.round((w / Math.max(1, games)) * 100)

  // karyera tarixi
  const numClubs = 4 + Math.floor(rng() * 3)
  const pool = CAREER_CLUBS.filter((c) => c !== team)
  let year = 2026
  const career = []
  // joriy jamoa birinchi
  const curStart = year - (1 + Math.floor(rng() * 4))
  career.push({
    club: team, c: colorOf(team), from: curStart, to: 'hozir',
    games: games, ppg, trophies: Math.floor(rng() * 3),
  })
  year = curStart
  for (let i = 0; i < numClubs; i++) {
    const club = pool.splice(Math.floor(rng() * pool.length), 1)[0]
    if (!club) break
    const span = 1 + Math.floor(rng() * 4)
    const to = year
    const from = year - span
    const g = span * (34 + Math.floor(rng() * 14))
    career.push({
      club, c: colorOf(club), from, to,
      games: g,
      ppg: (1.2 + rng() * 1.3).toFixed(2),
      trophies: Math.floor(rng() * 4),
    })
    year = from
  }

  const totalGames = career.reduce((s, c) => s + c.games, 0)
  const totalTrophies = career.reduce((s, c) => s + c.trophies, 0)

  const matches = MATCHES.filter((m) => m.home.n === team || m.away.n === team)

  return {
    name, team, teamColor: colorOf(team), leagueId,
    flag, country: FLAG_COUNTRY[flag], age, formation,
    record: { w, d, l, games, ppg, winPct },
    career, totalGames, totalTrophies,
    matches,
  }
}
