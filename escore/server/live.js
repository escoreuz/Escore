// Jonli hisob mexanizmi — server tomonida jonli o'yinlar daqiqasini yuritadi.
import { MATCHES } from '../src/data/score.js'

// MATCHES ning o'zgaruvchan nusxasi (asl ma'lumotga tegmaymiz)
const live = MATCHES.map((m) => ({ ...m, home: { ...m.home }, away: { ...m.away } }))
const byId = new Map(live.map((m) => [m.id, m]))

let ticks = 0

// Har chaqiriqda jonli o'yinlar daqiqasi +1; 90 ga yetganda — tugaydi
export function tick() {
  ticks++
  for (const m of live) {
    if (m.status === 'live') {
      m.minute = (m.minute || 0) + 1
      if (m.minute >= 90) {
        m.minute = 90
        m.status = 'ft'
      }
    }
  }
  return ticks
}

export function getAll() {
  return live
}
export function getOne(id) {
  return byId.get(id)
}
export function liveCount(date) {
  return live.filter((m) => m.date === date && m.status === 'live').length
}

// Server ishga tushganda intervalni boshlash
export function startEngine(intervalMs = 8000) {
  setInterval(tick, intervalMs)
}
