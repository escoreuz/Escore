// Hakam sahifasi — karyera statistikasi va boshqargan o'yinlar. Seedlangan.
import { MATCHES } from './score.js'
import { getMatchReferee } from './matchDetails.js'

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

const FLAGS = ['🇺🇿', '🇪🇸', '🇮🇹', '🇩🇪', '🏴', '🇫🇷', '🇵🇱', '🇵🇹']
const FLAG_COUNTRY = {
  '🇺🇿': "O'zbekiston",
  '🇪🇸': 'Ispaniya',
  '🇮🇹': 'Italiya',
  '🇩🇪': 'Germaniya',
  '🏴': 'Angliya',
  '🇫🇷': 'Fransiya',
  '🇵🇱': 'Polsha',
  '🇵🇹': 'Portugaliya',
}

// karyera statistikasi uchun turnirlar
const COMPETITIONS = [
  { id: 'epl', name: 'Premyer-liga', flag: '🏴' },
  { id: 'laliga', name: 'La Liga', flag: '🇪🇸' },
  { id: 'ucl', name: 'Chempionlar ligasi', flag: '🏆' },
  { id: 'cup', name: 'Kubok', flag: '🥇' },
]

export function getReferee(name) {
  const rng = mulberry32(seedFrom('referee|' + name))
  const flag = FLAGS[Math.floor(rng() * FLAGS.length)]
  const age = 35 + Math.floor(rng() * 20)

  // turnirlar bo'yicha karyera statistikasi
  const career = COMPETITIONS.map(comp => {
    const apps = 8 + Math.floor(rng() * 90)
    const avgYellow = (3.2 + rng() * 2.6).toFixed(1)
    const red = Math.floor(apps * (0.02 + rng() * 0.05))
    const pen = Math.floor(apps * (0.03 + rng() * 0.06))
    return { ...comp, apps, avgYellow, red, pen }
  }).filter(c => c.apps > 12 || c.id === 'epl') // ba'zilarini ko'rsatish

  const totals = career.reduce(
    (a, c) => ({
      apps: a.apps + c.apps,
      red: a.red + c.red,
      pen: a.pen + c.pen,
      yellow: a.yellow + Math.round(c.avgYellow * c.apps),
    }),
    { apps: 0, red: 0, pen: 0, yellow: 0 },
  )

  // boshqargan o'yinlar — shu hakamga tayinlangan o'yinlar
  const matches = MATCHES.filter(m => getMatchReferee(m.id) === name)

  return {
    name,
    flag,
    country: FLAG_COUNTRY[flag],
    age,
    career,
    totals,
    matches,
  }
}
