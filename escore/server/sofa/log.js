// SofaScore adapteri uchun log va qisman natijalarni ochiq hisobga olish.
// Qoida:
//   NotFoundError  — ma'lumot MAVJUD EMAS (bo'sh natija, `unavailable` ga yozilmaydi);
//   UpstreamError  — ma'lumot YUKLANMADI: log + `meta.unavailable` ga bo'lim nomi;
//   boshqa xato    — dasturiy xato, yashirilmaydi (qayta tashlanadi).

import { NotFoundError, UpstreamError } from '../errors.js'

/** @param {string} label @param {unknown} err */
export function logPartial(label, err) {
  const msg = err instanceof Error ? err.message : String(err)
  console.warn(`[sofa] qisman natija — ${label}: ${msg}`)
}

/**
 * Bitta javob uchun qisman natijalar yig'uvchisi.
 * @param {string} scope  log uchun prefiks (masalan 'teams/10')
 */
export function createPartial(scope) {
  /** @type {string[]} */
  const unavailable = []

  /**
   * @template T
   * @param {PromiseSettledResult<T>} result
   * @param {string} name  bo'lim nomi (meta.unavailable da ko'rinadi)
   * @param {T} fallback
   * @returns {T}
   */
  function take(result, name, fallback) {
    if (result.status === 'fulfilled') return result.value
    const err = result.reason
    if (err instanceof NotFoundError) return fallback
    if (!(err instanceof UpstreamError)) throw err
    logPartial(`${scope}/${name}`, err)
    if (!unavailable.includes(name)) unavailable.push(name)
    return fallback
  }

  return {
    take,
    /** Bitta ixtiyoriy so'rov. */
    async settle(promise, name, fallback) {
      const [result] = await Promise.allSettled([promise])
      return take(result, name, fallback)
    },
    /** Yuklanmagan bo'limlar ro'yxati (nusxa). */
    get unavailable() {
      return [...unavailable]
    },
  }
}
