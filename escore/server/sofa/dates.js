// Sana/vaqt yordamchilari — barchasi Asia/Tashkent mintaqasida (server UTC bo'lsa ham to'g'ri).

export const TIME_ZONE = 'Asia/Tashkent'
const DAY_MS = 86_400_000
const SECONDS_PER_DAY = 86_400
const DAY_RANGE = 2 // kun tasmasi: bugun ± 2

const PARTS_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function pad(n) {
  return String(n).padStart(2, '0')
}

/**
 * Berilgan lahzaning Toshkentdagi sana/vaqt qismlari.
 * @param {Date} date
 * @returns {{ year: number, month: number, day: number, hour: number, minute: number }}
 */
export function tashkentParts(date) {
  const parts = Object.fromEntries(PARTS_FORMAT.formatToParts(date).map(p => [p.type, p.value]))
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  }
}

function ymd({ year, month, day }) {
  return `${year}-${pad(month)}-${pad(day)}`
}

/** Unix soniya → Toshkent bo'yicha 'HH:MM'; yaroqsiz vaqt → null. */
export function timeStr(ts) {
  if (!Number.isFinite(ts)) return null
  const p = tashkentParts(new Date(ts * 1000))
  return `${pad(p.hour)}:${pad(p.minute)}`
}

/** Unix soniya → Toshkent bo'yicha 'YYYY-MM-DD'; yaroqsiz vaqt → null. */
export function dateStr(ts) {
  if (!Number.isFinite(ts)) return null
  return ymd(tashkentParts(new Date(ts * 1000)))
}

/** Unix soniya → Toshkent bo'yicha yil (yo'q bo'lsa null). */
export function yearFrom(ts) {
  return Number.isFinite(ts) && ts ? tashkentParts(new Date(ts * 1000)).year : null
}

/** UTC kun raqami (reyting ↔ o'yin bog'lash uchun; ikkala tomon ham UTC). */
export function dayKey(ts) {
  return Math.floor(ts / SECONDS_PER_DAY)
}

const DOW = ['YAK', 'DUSH', 'SESH', 'CHOR', 'PAY', 'JUM', 'SHA']
const DOW_LABEL = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba']

/** 'YYYY-MM-DD' sanadan `offset` kun siljigan sana (taqvim arifmetikasi, UTC). */
export function shiftDate(date, offset) {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d) + offset * DAY_MS)
  return ymd({ year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() })
}

/** Dinamik kun tasmasi (bugun ± 2), Toshkent sanasi bo'yicha. */
export function days() {
  const today = tashkentParts(new Date())
  const base = Date.UTC(today.year, today.month - 1, today.day)
  const list = []
  for (let off = -DAY_RANGE; off <= DAY_RANGE; off++) {
    const d = new Date(base + off * DAY_MS)
    list.push({
      date: ymd({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }),
      dow: DOW[d.getUTCDay()],
      d: pad(d.getUTCDate()),
      label: off === 0 ? 'Bugun' : DOW_LABEL[d.getUTCDay()],
    })
  }
  return { today: ymd(today), days: list }
}

/** So'nggi `count` oy (eng eskisidan), Toshkent bo'yicha: [{ year, month0 }]. */
export function lastMonths(count) {
  const now = tashkentParts(new Date())
  const out = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.year, now.month - 1 - i, 1))
    out.push({ year: d.getUTCFullYear(), month0: d.getUTCMonth() })
  }
  return out
}
