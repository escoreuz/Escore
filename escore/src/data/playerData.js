// O'yinchi sahifasi — ma'lumot, atributlar, statistika. Seedlangan generatsiya.
import { MATCHES } from './score.js'
import { colorOf } from './leagueData.js'

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

const FLAGS = ['🏴', '🇪🇸', '🇧🇷', '🇫🇷', '🇩🇪', '🇮🇹', '🇦🇷', '🇵🇹', '🇺🇿', '🇳🇱', '🇧🇪', '🇭🇷']
const FLAG_COUNTRY = {
  '🏴': 'Angliya', '🇪🇸': 'Ispaniya', '🇧🇷': 'Braziliya', '🇫🇷': 'Fransiya',
  '🇩🇪': 'Germaniya', '🇮🇹': 'Italiya', '🇦🇷': 'Argentina', '🇵🇹': 'Portugaliya',
  '🇺🇿': 'O\'zbekiston', '🇳🇱': 'Niderlandiya', '🇧🇪': 'Belgiya', '🇭🇷': 'Xorvatiya',
}
const POS_LABEL = { DG: 'Darvozabon', HIM: 'Himoyachi', YN: 'Yarim himoyachi', HJ: 'Hujumchi' }
const POS_LIST = ['DG', 'HIM', 'YN', 'HJ']

// Squad va o'yinchi sahifasi mos kelishi uchun umumiy "baza"
export function playerBase(team, name) {
  const rng = mulberry32(seedFrom('base|' + team + '|' + name))
  const flag = FLAGS[Math.floor(rng() * FLAGS.length)]
  return {
    number: 1 + Math.floor(rng() * 30),
    age: 18 + Math.floor(rng() * 18),
    flag,
    country: FLAG_COUNTRY[flag],
    height: 168 + Math.floor(rng() * 30),
    foot: rng() > 0.78 ? 'Chap' : rng() > 0.2 ? 'O\'ng' : 'Ikkalasi',
  }
}

const ATTR_KEYS = [
  { key: 'hujum', label: 'Hujum' },
  { key: 'texnika', label: 'Texnika' },
  { key: 'taktika', label: 'Taktika' },
  { key: 'himoya', label: 'Himoya' },
  { key: 'ijod', label: 'Ijodkorlik' },
]

// pozitsiyaga qarab atribut og'irligi
const WEIGHTS = {
  DG: { hujum: 0.2, texnika: 0.55, taktika: 0.7, himoya: 0.95, ijod: 0.3 },
  HIM: { hujum: 0.4, texnika: 0.6, taktika: 0.8, himoya: 0.92, ijod: 0.45 },
  YN: { hujum: 0.65, texnika: 0.85, taktika: 0.82, himoya: 0.6, ijod: 0.85 },
  HJ: { hujum: 0.95, texnika: 0.8, taktika: 0.6, himoya: 0.3, ijod: 0.8 },
}

export function getPlayer(team, name, posHint) {
  const rng = mulberry32(seedFrom('player|' + team + '|' + name))
  const base = playerBase(team, name)
  const pos = posHint && POS_LIST.includes(posHint) ? posHint : POS_LIST[Math.floor(rng() * 4)]
  const w = WEIGHTS[pos]

  const attrs = ATTR_KEYS.map((a) => ({
    ...a,
    val: Math.round(Math.min(99, Math.max(40, w[a.key] * 100 + (rng() - 0.5) * 22))),
  }))
  const overall = Math.round(attrs.reduce((s, a) => s + a.val, 0) / attrs.length)

  // bozor narxi (mln €) — umumiy reytingdan
  const value = Math.max(2, Math.round((overall - 55) * 4.5 + rng() * 20))

  // kuchli / kuchsiz tomonlar
  const sorted = [...attrs].sort((a, b) => b.val - a.val)
  const strengths = sorted.slice(0, 2).map((a) => a.label)
  const weaknesses = sorted.slice(-1).map((a) => a.label)

  // mavsum statistikasi
  const apps = 18 + Math.floor(rng() * 20)
  const scale = { DG: 0, HIM: 0.18, YN: 0.5, HJ: 1 }[pos]
  const goals = Math.round(scale * apps * (0.25 + rng() * 0.4))
  const assists = Math.round((0.3 + scale * 0.6) * apps * (0.15 + rng() * 0.3))
  const rating = (6.4 + overall / 100 * 1.6 + (rng() - 0.5) * 0.2).toFixed(2)

  const stats = [
    { group: 'Umumiy', rows: [
      ['O\'yinlar', apps],
      ['Asosiy tarkibda', apps - Math.floor(rng() * 5)],
      ['Daqiqalar', apps * (70 + Math.floor(rng() * 20))],
      ['O\'rtacha reyting', rating],
    ] },
    { group: 'Hujum', rows: [
      ['Gollar', goals],
      ['Uzatmalar', assists],
      ['Kutilgan gollar (xG)', (goals * (0.8 + rng() * 0.3)).toFixed(1)],
      ['Zarbalar (o\'yiniga)', (0.5 + scale * 3 * rng() + 0.5).toFixed(1)],
      ['Muvaffaqiyatli dribling', Math.round(scale * 40 + rng() * 20)],
    ] },
    { group: 'Aniqlik / Himoya', rows: [
      ['Uzatma aniqligi', (80 + Math.floor(rng() * 15)) + '%'],
      ['Tubdan to\'plar (o\'yiniga)', ((1 - scale) * 3 * rng() + 0.4).toFixed(1)],
      ['To\'siqlar', Math.round((1 - scale) * 60 + rng() * 20)],
      ['Sariq kartalar', Math.floor(rng() * 8)],
    ] },
  ]

  // oxirgi o'yinlar reytingi (jamoaning o'yinlaridan)
  const teamMatches = MATCHES.filter((m) => m.home.n === team || m.away.n === team)
  const recent = teamMatches.map((m) => ({
    m,
    isHome: m.home.n === team,
    rating: (6.2 + rng() * 2.6).toFixed(1),
  }))
  // forma reytinglari (sparkline)
  const ratingForm = Array.from({ length: 10 }, () => +(6.2 + rng() * 2.6).toFixed(1))

  return {
    name, team, teamColor: colorOf(team),
    pos, posLabel: POS_LABEL[pos],
    base, attrs, overall, value,
    strengths, weaknesses, stats,
    rating, recent, ratingForm,
  }
}

export { ATTR_KEYS }
