// Umumiy formatlash yordamchilari (UI va transportdan mustaqil, sof funksiyalar)

const SAFE_PROTOCOLS = new Set(['http:', 'https:'])

/**
 * Tashqi havolani tekshiradi: faqat mutlaq http/https URL o'tadi.
 * javascript:, data:, nisbiy yo'l va boshqalar → null.
 * @param {unknown} u
 * @returns {string|null} normallashtirilgan URL (URL.href) yoki null
 */
export function safeUrl(u) {
  if (typeof u !== 'string') return null
  const raw = u.trim()
  if (!raw) return null
  try {
    const parsed = new URL(raw)
    return SAFE_PROTOCOLS.has(parsed.protocol) ? parsed.href : null
  } catch {
    // URL konstruktori nisbiy/buzilgan qiymatda xato beradi — bu yaroqsiz havola degani
    return null
  }
}

const MULTI_WORD_LETTERS = 2
const SINGLE_WORD_LETTERS = 3

// So'z ajratuvchi: harf (\p{L}), diakritik belgi (\p{M}) va raqamdan (\p{N}) boshqa hamma narsa
// (bo'shliq, defis, apostrof, nuqta, emoji). Shu tufayli bayroq emoji yarmi initsialga tushmaydi.
const WORD_SEPARATOR = /[^\p{L}\p{M}\p{N}]+/u

/**
 * Nomdan initsiallar: ko'p so'zli → birinchi 2 so'zning bosh harfi, bitta so'z → dastlabki 3 belgi.
 * Masalan: 'Real Madrid' → 'RM', 'Al-Hilal' → 'AH', "O'zbekiston" → 'OZ', 'Barcelona' → 'BAR'.
 * @param {unknown} name
 * @returns {string} harf/raqam bo'lmasa bo'sh satr
 */
export function initials(name) {
  if (typeof name !== 'string') return ''
  const words = name.split(WORD_SEPARATOR).filter(Boolean)
  if (!words.length) return ''
  const letters =
    words.length > 1
      ? words.slice(0, MULTI_WORD_LETTERS).map(w => Array.from(w)[0])
      : Array.from(words[0]).slice(0, SINGLE_WORD_LETTERS)
  return letters.join('').toUpperCase()
}

export const TASHKENT_TZ = 'Asia/Tashkent'

const MONTHS = [
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
const WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba']

const PARTS_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: TASHKENT_TZ,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function toDate(date) {
  if (date == null || date === '') return null
  const d = date instanceof Date ? date : new Date(date)
  return Number.isNaN(d.getTime()) ? null : d
}

// Sana qismlari Toshkent vaqtida: { year, month (1-12), day, hour, minute, weekday (0=yakshanba) }
function tashkentParts(d) {
  const parts = {}
  for (const p of PARTS_FORMAT.formatToParts(d)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value)
  }
  const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()
  return { ...parts, weekday }
}

const pad2 = n => String(n).padStart(2, '0')

/**
 * Sanani Toshkent vaqti bo'yicha o'zbekcha formatlaydi: "Payshanba, 15-oktabr 2026, 14:05".
 * @param {Date|string|number} date
 * @param {{ weekday?: boolean, year?: boolean, time?: boolean }} [opts]
 * @returns {string} yaroqsiz sanada bo'sh satr
 */
export function fmtTashkentDate(date, { weekday = false, year = true, time = false } = {}) {
  const d = toDate(date)
  if (!d) return ''
  const p = tashkentParts(d)
  let out = `${p.day}-${MONTHS[p.month - 1]}`
  if (year) out += ` ${p.year}`
  if (weekday) out = `${WEEKDAYS[p.weekday]}, ${out}`
  if (time) out += `, ${pad2(p.hour)}:${pad2(p.minute)}`
  return out
}

/**
 * Toshkent vaqtidagi kalendar kuni: 'YYYY-MM-DD' (server /api/days bilan bir xil mintaqa).
 * @param {Date|string|number} [date]
 * @returns {string} yaroqsiz sanada bo'sh satr
 */
export function tashkentDateKey(date = new Date()) {
  const d = toDate(date)
  if (!d) return ''
  const p = tashkentParts(d)
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`
}
