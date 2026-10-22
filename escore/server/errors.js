// Server bo'ylab umumiy xato klasslari (FIX-PLAN §2.1).
// UpstreamError — tashqi manba (score-api / SofaScore) ishlamadi yoki vaqti tugadi.
// NotFoundError — resurs haqiqatan yo'q (upstream 404).
// BadRequestError — so'rov parametri yaroqsiz (400).

export class UpstreamError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, cause?: unknown }} [options]
   */
  constructor(message, { status = 502, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'UpstreamError'
    this.status = status
  }
}

export class NotFoundError extends Error {
  /**
   * @param {string} message
   * @param {{ cause?: unknown }} [options]
   */
  constructor(message, { cause } = {}) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'NotFoundError'
    this.status = 404
  }
}

// So'rov parametri yaroqsiz (masalan, xavfsiz bo'lmagan path segmenti) — index.js 400 ga xaritalaydi.
export class BadRequestError extends Error {
  /**
   * @param {string} message
   * @param {{ cause?: unknown }} [options]
   */
  constructor(message, { cause } = {}) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'BadRequestError'
    this.status = 400
  }
}
