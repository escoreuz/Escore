// Liga sahifasi — har bir liga uchun jadval (ALL/HOME/AWAY) va bombardirlar.
// Deterministik (seed bo'yicha) generatsiya.
import { LEAGUES } from './score.js'

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

export const TEAMS = {
  epl: ['Man City', 'Arsenal', 'Liverpool', 'Aston Villa', 'Tottenham', 'Man Utd', 'Newcastle', 'Chelsea', 'Brighton', 'Fulham', 'Wolves', 'Everton'],
  cha: ['Leeds', 'Leicester', 'Ipswich', 'Southampton', 'WBA', 'Norwich', 'Hull', 'Preston', 'Cardiff', 'Watford'],
  laliga: ['Real Madrid', 'Barcelona', 'Atletico', 'Girona', 'Sevilla', 'Betis', 'Valencia', 'Villarreal', 'Bilbao', 'Sociedad'],
  seriea: ['Inter', 'Milan', 'Juventus', 'Napoli', 'Roma', 'Lazio', 'Atalanta', 'Bologna', 'Fiorentina', 'Torino'],
  uzs: ['Pakhtakor', 'Nasaf', 'AGMK', 'Bunyodkor', 'Navbahor', 'Surxon', 'Andijon', 'Sogdiana', 'Olympic', 'Dinamo'],
  ucl: ['Real Madrid', 'Man City', 'Bayern', 'PSG', 'Inter', 'Barcelona', 'Arsenal', 'Atletico'],
}

const COLORS = {
  'Man City': '#6caddf', Arsenal: '#e3000b', Liverpool: '#c8102e', 'Aston Villa': '#7b003a',
  Tottenham: '#132257', 'Man Utd': '#da291c', Newcastle: '#241f20', Chelsea: '#1f3a8a',
  Brighton: '#0057b8', Fulham: '#1a1a1a', Wolves: '#fdb913', Everton: '#003399',
  'Real Madrid': '#c9a227', Barcelona: '#a50044', Atletico: '#cb3524', Girona: '#d81e05',
  Sevilla: '#d81e05', Betis: '#009b3a', Valencia: '#ee3524', Villarreal: '#e0b400',
  Bilbao: '#ee2523', Sociedad: '#0067b1', Inter: '#0b1f5e', Milan: '#fb090b',
  Juventus: '#1a1a1a', Napoli: '#12a0d7', Roma: '#8e1f2f', Lazio: '#5aa9e6',
  Atalanta: '#1d1d1b', Bologna: '#a81e2f', Fiorentina: '#592c82', Torino: '#8a1f2b',
  Leeds: '#1d428a', Leicester: '#003090', Ipswich: '#3a64a3', Southampton: '#d71920',
  WBA: '#122f67', Norwich: '#00a650', Hull: '#f18a01', Preston: '#7a7a7a',
  Cardiff: '#0070b5', Watford: '#e2c200', Pakhtakor: '#1f5130', Nasaf: '#1e73be',
  AGMK: '#f7941e', Bunyodkor: '#d52b1e', Navbahor: '#1e8c3a', Surxon: '#176fb0',
  Andijon: '#0a6e3a', Sogdiana: '#b5121b', Olympic: '#1a4f9c', Dinamo: '#1d6fb8',
  Bayern: '#dc052d', PSG: '#004170',
}
export const colorOf = (n) => COLORS[n] || '#777'

// Jamoaning asosiy (mahalliy) ligasi — UCL emas
export function teamPrimaryLeague(name) {
  let fallback = null
  for (const [lid, teams] of Object.entries(TEAMS)) {
    if (teams.includes(name)) {
      if (lid !== 'ucl') return lid
      fallback = lid
    }
  }
  return fallback
}

const STRIKERS = [
  'Holland', 'Salah', 'Mbappe', 'Martinez', 'Lewandowski', 'Kane', 'Vlahovic',
  'Osimhen', 'Griezmann', 'Morata', 'Zoyirov', 'Shomurodov', 'Vinicius',
  'Bellingham', 'Isak', 'Watkins', 'Toney', 'Foden',
]

function splitStats(rng, games, strength) {
  const w = Math.min(games, Math.max(0, Math.round(strength * games * 0.7 + (rng() - 0.5) * 2)))
  const d = Math.min(games - w, Math.max(0, Math.round((1 - strength) * games * 0.35 + (rng() - 0.5))))
  const l = games - w - d
  return { w, d, l }
}

export function getLeagueTable(leagueId) {
  const league = leagueById[leagueId]
  const teams = TEAMS[leagueId] || []
  const rng = mulberry32(seedFrom('table-' + leagueId))
  const half = leagueId === 'ucl' ? 3 : 15 // uy/mehmon o'yinlari soni

  const rows = teams.map((name) => {
    const strength = 0.35 + rng() * 0.6
    const home = splitStats(rng, half, strength + 0.08)
    const away = splitStats(rng, half, strength - 0.05)
    const total = { w: home.w + away.w, d: home.d + away.d, l: home.l + away.l }
    const P = total.w + total.d + total.l
    const gf = total.w * 2 + total.d + Math.floor(rng() * 12)
    const ga = total.l * 2 + Math.floor(rng() * 9)
    // forma — oxirgi 5
    const form = Array.from({ length: 5 }, () => {
      const r = rng()
      const p = strength
      return r < p * 0.7 ? 'G' : r < p * 0.7 + 0.25 ? 'D' : 'M'
    })
    return {
      name, c: colorOf(name),
      home, away, total,
      P, GF: gf, GA: ga, GD: gf - ga,
      Pts: total.w * 3 + total.d,
      form,
    }
  })

  rows.sort((a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF)
  rows.forEach((r, i) => { r.pos = i + 1 })
  return { league, rows, teamCount: rows.length }
}

export function getLeagueScorers(leagueId) {
  const teams = TEAMS[leagueId] || []
  const rng = mulberry32(seedFrom('scorers-' + leagueId))
  const list = []
  const usedNames = new Set()
  for (let i = 0; i < 8; i++) {
    let name
    do { name = STRIKERS[Math.floor(rng() * STRIKERS.length)] } while (usedNames.has(name) && usedNames.size < STRIKERS.length)
    usedNames.add(name)
    const team = teams[Math.floor(rng() * teams.length)]
    list.push({ name, team, c: colorOf(team), goals: 0, assists: Math.floor(rng() * 12) })
  }
  // gollar kamayuvchi tartibda
  let g = 22
  list.forEach((p) => { p.goals = g; g -= 1 + Math.floor(rng() * 2) })
  list.sort((a, b) => b.goals - a.goals)
  list.forEach((p, i) => { p.rank = i + 1 })
  return list
}
