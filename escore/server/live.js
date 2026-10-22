// Demo jonli hisob mexanizmi — FAQAT DEMO rejimda (USE_REAL=0) ishlatiladi.
// Demo o'yinlar sanasi bugungi (Toshkent) kunga suriladi, jonli o'yinlar daqiqasi
// interval bilan oshiriladi. Real rejimda bu modul ishga tushirilmaydi.

export const TASHKENT_TZ = 'Asia/Tashkent'
const DAY_MS = 24 * 60 * 60 * 1000
const FULL_TIME_MINUTE = 90
const DEFAULT_INTERVAL_MS = 8000

const tashkentFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TASHKENT_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Berilgan vaqtning Toshkentdagi sanasi: 'YYYY-MM-DD'. */
export function tashkentDate(now = new Date()) {
  return tashkentFormatter.format(now)
}

/** 'YYYY-MM-DD' sanaga kun qo'shadi (UTC hisobida, vaqt mintaqasidan mustaqil). */
export function addDays(isoDate, offset) {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + offset * DAY_MS).toISOString().slice(0, 10)
}

function dayDiff(fromIso, toIso) {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / DAY_MS)
}

/**
 * Demo jonli dvigatel. Har nusxa o'z holatiga ega (global o'zgaruvchan holat yo'q).
 * @param {{ matches: object[], baseDate: string, today?: string, intervalMs?: number }} opts
 *   matches — demo o'yinlar; baseDate — demo ma'lumotdagi "bugun"; today — joriy sana.
 */
export function createLiveEngine({ matches, baseDate, today = tashkentDate(), intervalMs = DEFAULT_INTERVAL_MS }) {
  const shift = dayDiff(baseDate, today)
  // Asl ma'lumotga tegmaymiz: har o'yinning mustaqil nusxasi, sanasi bugunga surilgan
  const live = matches.map(m => ({ ...m, date: addDays(m.date, shift), home: { ...m.home }, away: { ...m.away } }))
  const byId = new Map(live.map(m => [m.id, m]))
  let timer = null

  // Har chaqiriqda jonli o'yinlar daqiqasi +1; 90 ga yetganda — tugaydi
  function tick() {
    for (const m of live) {
      if (m.status !== 'live') continue
      m.minute = Math.min((m.minute || 0) + 1, FULL_TIME_MINUTE)
      if (m.minute === FULL_TIME_MINUTE) m.status = 'ft'
    }
  }

  return {
    today,
    tick,
    getAll: () => live,
    getOne: id => byId.get(id) || null,
    start() {
      if (timer) return
      timer = setInterval(tick, intervalMs)
      timer.unref() // jarayon yopilishiga to'sqinlik qilmasin
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
    },
  }
}
