// Score sahifasi uchun sof yordamchilar: holat yorlig'i, hisob matni, featured, guruhlash, o'zgarish e'lonlari.
// UI va tarmoqdan mustaqil — alohida unit testlanadi.
import { matchTime } from '../../settings.js'

/** Jonli o'yin bo'lsa yangilash oralig'i (ms). */
export const LIVE_POLL_MS = 15_000
/** Jonli o'yin yo'q bo'lsa yangilash oralig'i (ms). */
export const IDLE_POLL_MS = 60_000

const FINAL_LABEL = {
  ft: 'FT',
  canceled: 'Bekor qilindi',
  postponed: 'Qoldirildi',
  interrupted: "To'xtatildi",
}

const STATUS_WORD = {
  live: 'Jonli',
  ft: 'Tugadi',
  sched: 'Rejada',
  canceled: 'Bekor qilindi',
  postponed: 'Qoldirildi',
  interrupted: "To'xtatildi",
}

const NO_VALUE = '—'

export const isLive = m => m?.status === 'live'

/** Hisob ma'lum (ikkala qiymat raqam) — null/undefined bo'lsa false. */
export const hasScore = m => Number.isFinite(m?.hs) && Number.isFinite(m?.as)

/** Jamoa nomi; yo'q bo'lsa "—". */
export const teamName = team => (typeof team?.n === 'string' && team.n.trim() ? team.n : NO_VALUE)

/**
 * Qatordagi qisqa holat: jonli → daqiqa, tugagan/bekor/qoldirilgan → yorliq, aks holda boshlanish vaqti.
 * @param {{ status?: string, minute?: number|null, ts?: number, time?: string|null }} m
 * @returns {string}
 */
export function statusLabel(m) {
  if (isLive(m)) return Number.isFinite(m.minute) ? `${m.minute}'` : 'Jonli'
  if (m && Object.hasOwn(FINAL_LABEL, m.status)) return FINAL_LABEL[m.status]
  return matchTime(m) || NO_VALUE
}

/** Holatning to'liq so'zi (featured blok uchun). */
export function statusWord(m) {
  return m && Object.hasOwn(STATUS_WORD, m.status) ? STATUS_WORD[m.status] : NO_VALUE
}

/** Ekran o'quvchi uchun to'liq hisob: "Arsenal 2 – 1 Chelsea" yoki hisobsiz "Arsenal – Chelsea". */
export function scoreText(m) {
  const home = teamName(m?.home)
  const away = teamName(m?.away)
  return hasScore(m) ? `${home} ${m.hs} – ${m.as} ${away}` : `${home} – ${away}`
}

/** Tanlangan o'yin: ro'yxatdagi birinchi jonli o'yin, bo'lmasa null (uydirma yo'q). */
export function pickFeatured(matches) {
  return (Array.isArray(matches) ? matches : []).find(isLive) ?? null
}

/** Jonli holatga qarab polling oralig'i. */
export const pollInterval = liveCount => (liveCount > 0 ? LIVE_POLL_MS : IDLE_POLL_MS)

function leagueKey(m) {
  const id = m.leagueId ?? m.league?.id
  if (id != null) return `id:${id}`
  return `name:${m.league?.country ?? ''}|${m.league?.name ?? ''}`
}

/**
 * O'yinlarni liga bo'yicha guruhlaydi (server tartibini saqlaydi).
 * @returns {{ key: string, leagueId: string|number|null, league: object, list: object[] }[]}
 */
export function groupByLeague(matches) {
  const groups = new Map()
  for (const m of Array.isArray(matches) ? matches : []) {
    const key = leagueKey(m)
    const group = groups.get(key)
    if (group) group.list.push(m)
    else groups.set(key, { key, leagueId: m.leagueId ?? m.league?.id ?? null, league: m.league ?? {}, list: [m] })
  }
  return [...groups.values()]
}

/**
 * Oldingi va yangi ro'yxat orasidagi muhim o'zgarishlar (hisob, yakun) — aria-live uchun bitta matn.
 * Birinchi yuklanishda (prev yo'q) bo'sh satr.
 * @param {object[]|null|undefined} prev
 * @param {object[]|null|undefined} next
 * @returns {string}
 */
export function describeChanges(prev, next) {
  if (!Array.isArray(prev) || !Array.isArray(next)) return ''
  const before = new Map(prev.map(m => [m.id, m]))
  const messages = []
  for (const m of next) {
    const old = before.get(m.id)
    if (!old) continue
    if (hasScore(old) && hasScore(m) && (old.hs !== m.hs || old.as !== m.as))
      messages.push(`Hisob o'zgardi: ${scoreText(m)}`)
    else if (old.status !== 'ft' && m.status === 'ft') messages.push(`Tugadi: ${scoreText(m)}`)
  }
  return messages.join('. ')
}
