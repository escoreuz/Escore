// Jamoa sahifasi — sostav, ma'lumot, forma, o'yinlar. Seedlangan generatsiya.
import { LEAGUES, MATCHES } from './score.js'
import { colorOf, teamPrimaryLeague, getLeagueTable } from './leagueData.js'
import { playerBase } from './playerData.js'

const leagueById = Object.fromEntries(LEAGUES.map((l) => [l.id, l]))

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

const SURNAMES = [
  'Yusupov', 'Karimov', 'Toshmatov', 'Aliev', 'Rashidov', 'Silva', 'Costa', 'Santos',
  'Garcia', 'Lopez', 'Martin', 'Muller', 'Schmidt', 'Rossi', 'Bianchi', 'Dubois',
  'Bernard', 'Johnson', 'Williams', 'Brown', 'Walker', 'Stones', 'Rice', 'Saka',
  'Foden', 'Mount', 'James', 'Kane', 'Sterling', 'Grealish', 'Mendez', 'Ramos',
  'Diaz', 'Fernandez', 'Lima', 'Pereira', 'Kovac', 'Novak', 'Petrov', 'Ivanov',
]
const FLAGS = ['🏴', '🇪🇸', '🇧🇷', '🇫🇷', '🇩🇪', '🇮🇹', '🇦🇷', '🇵🇹', '🇺🇿', '🇳🇱', '🇧🇪', '🇭🇷']

const GROUPS = [
  { key: 'gk', label: 'Darvozabonlar', pos: 'DG', count: 3 },
  { key: 'def', label: 'Himoyachilar', pos: 'HIM', count: 7 },
  { key: 'mid', label: 'Yarim himoyachilar', pos: 'YN', count: 7 },
  { key: 'fwd', label: 'Hujumchilar', pos: 'HJ', count: 5 },
]

// Bir nechta mashhur jamoa uchun aniq ma'lumot, qolganlari uchun generatsiya
const KNOWN = {
  'Real Madrid': { stadium: 'Santiago Bernabeu', city: 'Madrid', coach: 'C. Ancelotti', founded: 1902 },
  Barcelona: { stadium: 'Spotify Camp Nou', city: 'Barcelona', coach: 'H. Flick', founded: 1899 },
  Arsenal: { stadium: 'Emirates Stadium', city: 'London', coach: 'M. Arteta', founded: 1886 },
  Chelsea: { stadium: 'Stamford Bridge', city: 'London', coach: 'E. Maresca', founded: 1905 },
  Liverpool: { stadium: 'Anfield', city: 'Liverpool', coach: 'A. Slot', founded: 1892 },
  'Man City': { stadium: 'Etihad Stadium', city: 'Manchester', coach: 'P. Guardiola', founded: 1880 },
  'Man Utd': { stadium: 'Old Trafford', city: 'Manchester', coach: 'R. Amorim', founded: 1878 },
  Inter: { stadium: 'San Siro', city: 'Milan', coach: 'S. Inzaghi', founded: 1908 },
  Milan: { stadium: 'San Siro', city: 'Milan', coach: 'P. Fonseca', founded: 1899 },
  Juventus: { stadium: 'Allianz Stadium', city: 'Turin', coach: 'T. Motta', founded: 1897 },
  Bayern: { stadium: 'Allianz Arena', city: 'Munich', coach: 'V. Kompany', founded: 1900 },
  PSG: { stadium: 'Parc des Princes', city: 'Paris', coach: 'L. Enrique', founded: 1970 },
  Pakhtakor: { stadium: 'Markaziy stadion', city: 'Toshkent', coach: 'A. Ibrohimov', founded: 1956 },
  Nasaf: { stadium: 'Markaziy stadion', city: 'Qarshi', coach: 'R. Murodov', founded: 1986 },
  AGMK: { stadium: 'AGMK Arena', city: 'Olmaliq', coach: 'B. Ergashev', founded: 2005 },
}

const STADIUMS = ['Markaziy stadion', 'City Arena', 'National Stadium', 'Park Stadium']

function buildSquad(rng, team) {
  const usedNames = new Set()
  return GROUPS.map((g) => ({
    label: g.label,
    players: Array.from({ length: g.count }, () => {
      let name
      do { name = SURNAMES[Math.floor(rng() * SURNAMES.length)] } while (usedNames.has(name) && usedNames.size < SURNAMES.length)
      usedNames.add(name)
      // o'yinchi sahifasi bilan mos: raqam/yosh/bayroq playerBase'dan
      const b = playerBase(team, name)
      return { n: b.number, name, pos: g.pos, flag: b.flag, age: b.age }
    }).sort((a, b) => a.n - b.n),
  }))
}

export function getTeam(name) {
  const leagueId = teamPrimaryLeague(name)
  if (!leagueId) return null
  const rng = mulberry32(seedFrom('team-' + name))
  const league = leagueById[leagueId]
  const known = KNOWN[name]

  const info = known || {
    stadium: STADIUMS[Math.floor(rng() * STADIUMS.length)],
    city: league.country,
    coach: ['A. Rahimov', 'D. Yusupov', 'M. Karimov', 'J. Smith', 'L. Garcia'][Math.floor(rng() * 5)],
    founded: 1900 + Math.floor(rng() * 90),
  }

  // forma — liga jadvalidan
  const table = getLeagueTable(leagueId)
  const row = table.rows.find((r) => r.name === name)
  const form = row ? row.form : ['G', 'D', 'M', 'G', 'G']
  const standing = row ? row.pos : null

  // o'yinlar
  const matches = MATCHES.filter((m) => m.home.n === name || m.away.n === name)

  return {
    name,
    color: colorOf(name),
    league,
    leagueId,
    info,
    form,
    standing,
    squad: buildSquad(rng, name),
    matches,
    country: league.country,
  }
}
