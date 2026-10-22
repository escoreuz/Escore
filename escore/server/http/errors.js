// HTTP xatolari: domen xatolarini javob kodiga xaritalash (FIX-PLAN 2.1) va async o'ram.
// Javobda ichki ma'lumot (stack, upstream yo'li) yo'q — faqat logda.
import { UpstreamError, NotFoundError, BadRequestError } from '../errors.js'

export class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} code
   * @param {string} message foydalanuvchiga ko'rinadigan matn
   * @param {string[]} [details]
   */
  constructor(status, code, message, details) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export const badRequest = message => new HttpError(400, 'BAD_REQUEST', message)

/** @param {unknown} err @returns {HttpError} */
export function toHttpError(err) {
  if (err instanceof HttpError) return err
  if (err instanceof UpstreamError) {
    return new HttpError(503, 'UPSTREAM_UNAVAILABLE', "Ma'lumot manbai vaqtincha ishlamayapti")
  }
  if (err instanceof NotFoundError) return new HttpError(404, 'NOT_FOUND', "Ma'lumot topilmadi")
  if (err instanceof BadRequestError) return badRequest("So'rov yaroqsiz")
  if (err?.name === 'ArticleValidationError') {
    return new HttpError(400, 'BAD_REQUEST', "Maqola ma'lumoti yaroqsiz", err.errors)
  }
  if (err?.type === 'entity.too.large') return new HttpError(413, 'PAYLOAD_TOO_LARGE', "So'rov hajmi juda katta")
  if (err?.expose && err.status >= 400 && err.status < 500) return badRequest("So'rov yaroqsiz")
  return new HttpError(500, 'INTERNAL', 'Server xatosi')
}

/** Markaziy error middleware (Express 4 args imzosini talab qiladi). */
export function errorHandler(logger) {
  return (err, req, res, next) => {
    const httpErr = toHttpError(err)
    if (httpErr.code === 'INTERNAL') logger.error(`[error] ${req.method} ${req.path}`, err)
    if (httpErr.code === 'UPSTREAM_UNAVAILABLE') {
      logger.warn(`[upstream] ${req.path}: ${err.message} (status ${err.status ?? '?'})`)
    }
    if (res.headersSent) return next(err)
    const body = { error: httpErr.message, code: httpErr.code }
    if (httpErr.details) body.details = httpErr.details
    res.status(httpErr.status).json(body)
  }
}

// Express 4 async xatolarni o'zi ushlamaydi — har handler shu o'ram orqali o'tadi
export const wrap = fn => (req, res, next) =>
  Promise.resolve()
    .then(() => fn(req, res, next))
    .catch(next)

/** app.get/post/... qisqa yozuvi: oxirgi handler avtomatik o'raladi. */
export function router(app) {
  const add =
    method =>
    (path, ...handlers) =>
      app[method](path, ...handlers.slice(0, -1), wrap(handlers.at(-1)))
  return { get: add('get'), post: add('post'), put: add('put'), delete: add('delete') }
}
