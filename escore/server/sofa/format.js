// Umumiy mapperlar: SofaScore xom obyektlari → eSCORE frontendi kutadigan shakllar.

import { dateStr, tashkentParts, timeStr } from './dates.js'
import { logPartial } from './log.js'

const DEFAULT_COLOR = '#444'
const SECONDS_PER_YEAR = 365.25 * 24 * 3600
const FT_MINUTE = 90
const REGIONAL_INDICATOR_A = 0x1f1e6
const CHAR_CODE_A = 65
const WINNER_HOME = 1
const WINNER_AWAY = 2
const WINNER_DRAW = 3

// Davlat/kategoriya → bayroq emoji (taxminiy; topilmasa umumiy belgi)
const FLAGS = {
  england: '🏴',
  scotland: '🏴',
  wales: '🏴',
  spain: '🇪🇸',
  italy: '🇮🇹',
  germany: '🇩🇪',
  france: '🇫🇷',
  netherlands: '🇳🇱',
  portugal: '🇵🇹',
  uzbekistan: '🇺🇿',
  usa: '🇺🇸',
  brazil: '🇧🇷',
  argentina: '🇦🇷',
  japan: '🇯🇵',
  'saudi arabia': '🇸🇦',
  turkey: '🇹🇷',
  belgium: '🇧🇪',
  mexico: '🇲🇽',
  international: '🌍',
  world: '🌍',
  europe: '🏆',
}

/** Massiv bo'lsa o'zi, aks holda [] (upstream shakli kutilmagan bo'lsa yiqilmaslik uchun). */
export function arr(x) {
  return Array.isArray(x) ? x : []
}

export function colorOf(team) {
  return team?.teamColors?.primary || DEFAULT_COLOR
}

export function flagFor(cat) {
  if (!cat) return '⚽'
  const key = (cat.name || cat.slug || cat.flag || '').toLowerCase()
  return (Object.hasOwn(FLAGS, key) && FLAGS[key]) || (cat.country?.alpha2 ? '🏳️' : '🏆')
}

/** Davlat alpha2 (FR, ES...) → bayroq emoji (regional indicator belgilaridan). */
export function flagEmoji(alpha2) {
  if (typeof alpha2 !== 'string' || !/^[A-Za-z]{2}$/.test(alpha2)) return '🏳️'
  return String.fromCodePoint(
    ...[...alpha2.toUpperCase()].map(c => REGIONAL_INDICATOR_A + c.charCodeAt(0) - CHAR_CODE_A),
  )
}

// SofaScore status.type → eSCORE statusi. 'sched' faqat haqiqatan boshlanmagan o'yin.
const STATUS_MAP = new Map([
  ['notstarted', 'sched'],
  ['delayed', 'sched'],
  ['inprogress', 'live'],
  ['finished', 'ft'],
  ['canceled', 'canceled'],
  ['postponed', 'postponed'],
  ['interrupted', 'interrupted'],
  ['suspended', 'interrupted'],
  ['abandoned', 'interrupted'],
  ['willcontinue', 'interrupted'],
])

/**
 * Statussiz yoki noma'lum tur → null (taxmin qilinmaydi; frontend "noma'lum" ko'rsatadi).
 * @returns {'sched' | 'live' | 'ft' | 'canceled' | 'postponed' | 'interrupted' | null}
 */
export function mapStatus(type) {
  return STATUS_MAP.get(type) ?? null
}

export function ageFrom(ts) {
  if (!Number.isFinite(ts) || !ts) return null
  return Math.floor((Date.now() / 1000 - ts) / SECONDS_PER_YEAR)
}

const FULL_MONTHS_UZ = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avgust',
  'sentabr',
  'oktabr',
  'noyabr',
  'dekabr',
]

export function birthUz(ts) {
  if (!ts) return null
  const p = tashkentParts(new Date(ts * 1000))
  return `${p.day} ${FULL_MONTHS_UZ[p.month - 1]} ${p.year}`
}

export function followersText(n) {
  if (!n) return null
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return Math.round(n / 1e3) + 'k'
  return String(n)
}

// Jonli daqiqa — SofaScore period ma'lumotidan ANIQ hisoblanadi.
// time.currentPeriodStartTimestamp = joriy taym boshlangan vaqt;
// time.initial = taym boshidagi bazaviy soniya (1-taym 0, 2-taym 2700=45');
// time.max = taym chegarasi (1-taym 2700, 2-taym 5400). Tanaffus/qo'shimcha
// vaqtda chegarada (45'/90') to'xtab turamiz — startTimestamp'dan hisoblash
// tanaffusni xato qo'shib yuborardi.
export function liveMinute(ev) {
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
  const mins = Math.floor((now - ev.startTimestamp) / 60) + 1
  return Math.max(1, Math.min(mins, FT_MINUTE))
}

export function teamObj(t) {
  return { n: t?.shortName || t?.name || null, c: colorOf(t), id: t?.id ?? null }
}

function scoreOf(side) {
  return typeof side?.current === 'number' ? side.current : null
}

/** Event — vaqti haqiqiy (Unix soniya) bo'lsa true. */
export function hasValidStart(ev) {
  return Number.isFinite(ev?.startTimestamp)
}

/** Ro'yxatga yaroqli event: id bor va vaqti haqiqiy. */
export function isUsableEvent(ev) {
  return ev?.id != null && hasValidStart(ev)
}

export function mapMatch(ev, forcedDate) {
  const status = mapStatus(ev.status?.type)
  const ut = ev.tournament?.uniqueTournament || ev.tournament || {}
  const cat = ev.tournament?.category || ut.category || {}
  const leagueId = ut.id ?? ev.tournament?.id
  return {
    id: String(ev.id),
    date: forcedDate || dateStr(ev.startTimestamp),
    leagueId: leagueId == null ? null : String(leagueId),
    league: {
      id: ut.id == null ? null : String(ut.id),
      name: ut.name || ev.tournament?.name || null,
      country: cat.name || '',
      flag: flagFor(cat),
    },
    time: timeStr(ev.startTimestamp),
    ts: ev.startTimestamp,
    status,
    minute: status === 'live' ? liveMinute(ev) : null,
    home: teamObj(ev.homeTeam),
    away: teamObj(ev.awayTeam),
    hs: scoreOf(ev.homeScore),
    as: scoreOf(ev.awayScore),
  }
}

/**
 * Event ro'yxatini mapMatch qiladi; vaqti yaroqsiz eventlar log bilan tashlanadi (ro'yxat yiqilmaydi).
 * @param {unknown} events
 * @param {string} label  log uchun manba nomi
 */
export function mapEvents(events, label, forcedDate) {
  const list = arr(events)
  const valid = list.filter(isUsableEvent)
  if (valid.length < list.length)
    logPartial(label, new Error(`${list.length - valid.length} ta event vaqtsiz yoki id'siz — tashlandi`))
  return valid.map(ev => mapMatch(ev, forcedDate))
}

/** Bombardir qatori (scorers va liga sahifasi uchun umumiy). */
export function mapScorer(g, i) {
  return {
    rank: i + 1,
    id: g?.player?.id ?? null,
    teamId: g?.team?.id ?? null,
    name: g?.player?.shortName || g?.player?.name || '',
    team: g?.team?.shortName || g?.team?.name || '',
    goals: g?.statistics?.goals ?? null,
    c: colorOf(g?.team),
  }
}

/** Mavsumiy statistika reytingi matni ('7.12' yoki null). */
export function ratingText(s) {
  return s?.rating ? (+s.rating).toFixed(2) : null
}

/**
 * SofaScore winnerCode (1 uy, 2 mehmon, 3 durang) → tomon nuqtai nazaridan 'G' / 'D' / 'M'.
 * @param {number | undefined} winnerCode
 * @param {'home' | 'away' | null} side
 * @returns {'G' | 'D' | 'M' | null}
 */
export function resultFromWinner(winnerCode, side) {
  if (!side) return null
  if (winnerCode === WINNER_DRAW) return 'D'
  if (winnerCode !== WINNER_HOME && winnerCode !== WINNER_AWAY) return null
  return (winnerCode === WINNER_HOME) === (side === 'home') ? 'G' : 'M'
}
