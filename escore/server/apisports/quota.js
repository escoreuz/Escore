// Kvota boshqaruvi: daqiqalik sirpanuvchi oyna (navbat + maxWait) va kunlik byudjet.

import { UpstreamError } from '../errors.js'

const OVERLOAD_STATUS = 503
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Daqiqalik limiter: `windowMs` ichida ko'pi bilan `limit` ta so'rov. Navbat va kutish chegaralangan.
 * @param {{ limit: number, windowMs: number, maxQueue: number, maxWaitMs: number, now?: () => number }} o
 * @returns {() => Promise<void>}
 */
export function createRateWindow({ limit, windowMs, maxQueue, maxWaitMs, now = Date.now }) {
  const stamps = []
  let waiting = 0

  return async function acquire() {
    if (waiting >= maxQueue)
      throw new UpstreamError('API-Football daqiqalik navbati to’lgan', { status: OVERLOAD_STATUS })
    const deadline = now() + maxWaitMs
    waiting++
    try {
      for (;;) {
        while (stamps.length && now() - stamps[0] >= windowMs) stamps.shift()
        if (stamps.length < limit) {
          stamps.push(now())
          return
        }
        const wait = stamps[0] + windowMs - now()
        if (now() + wait > deadline) {
          throw new UpstreamError('API-Football daqiqalik limiti: kutish vaqti oshdi', { status: OVERLOAD_STATUS })
        }
        await sleep(wait)
      }
    } finally {
      waiting--
    }
  }
}

/** UTC kun (API-Football kunlik limiti 00:00 UTC da yangilanadi). */
function utcDay(ms) {
  return new Date(ms).toISOString().slice(0, 10)
}

/**
 * Kunlik byudjet: `x-ratelimit-requests-remaining` dan. Qolgan ≤ minBudget bo'lsa — faqat kesh.
 * Holat diskda (store.getMeta/setMeta) saqlanadi.
 * @param {{ store: { getMeta: Function, setMeta: Function }, minBudget: number, now?: () => number }} o
 */
export function createBudget({ store, minBudget, now = Date.now }) {
  function current() {
    const b = store.getMeta('budget')
    if (!b || b.day !== utcDay(now()) || !Number.isFinite(b.remaining)) return null
    return b.remaining
  }
  return {
    /** Qolgan so'rovlar (noma'lum bo'lsa null). */
    remaining: current,
    /** true — real so'rov yuborish mumkin emas (faqat kesh). */
    exhausted() {
      const r = current()
      return r !== null && r <= minBudget
    },
    /** Javob headeridan yangilash. */
    record(headerValue) {
      const n = Number.parseInt(headerValue ?? '', 10)
      if (Number.isFinite(n) && n >= 0) store.setMeta('budget', { day: utcDay(now()), remaining: n })
    },
    /** 429 yoki "kunlik limit" xatosi — bugun uchun byudjet 0. */
    exhaust() {
      store.setMeta('budget', { day: utcDay(now()), remaining: 0 })
    },
  }
}
