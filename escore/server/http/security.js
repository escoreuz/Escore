// Xavfsizlik qatlami: helmet, CORS, rate limit, ADMIN_TOKEN auth, so'rov logi (FIX-PLAN 2.4, 2.7).
import { createHash, timingSafeEqual } from 'node:crypto'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

import { HttpError } from './errors.js'
import { safeHttpUrl } from './validate.js'

const RATE_WINDOW_MS = 60 * 1000
const MIN_ADMIN_TOKEN_LENGTH = 16
export const DEFAULT_ORIGIN = 'http://localhost:5190'
export const SEO_PATHS = ['/share', '/sitemap.xml']
const CSP_DIRECTIVES = {
  defaultSrc: ["'none'"],
  styleSrc: ["'unsafe-inline'"],
  baseUri: ["'none'"],
  formAction: ["'none'"],
  frameAncestors: ["'none'"],
}

export function parseOrigins(raw) {
  const list = (raw || DEFAULT_ORIGIN).split(',').map(s => s.trim())
  return new Set(list.filter(Boolean))
}

export function parseSiteUrl(raw) {
  if (!raw) return DEFAULT_ORIGIN
  const url = safeHttpUrl(raw)
  if (!url) throw new Error("SITE_URL http(s) URL bo'lishi kerak")
  return url.replace(/\/+$/, '')
}

const sha256 = value => createHash('sha256').update(value).digest()

/** ADMIN_TOKEN: yo'q yoki qisqa bo'lsa — yozish o'chiq (403). */
export function requireAdmin(rawToken, logger) {
  const token = typeof rawToken === 'string' ? rawToken.trim() : ''
  if (token && token.length < MIN_ADMIN_TOKEN_LENGTH) {
    logger.warn(`[auth] ADMIN_TOKEN ${MIN_ADMIN_TOKEN_LENGTH} belgidan qisqa — yozish o'chirildi`)
  }
  const expected = token.length >= MIN_ADMIN_TOKEN_LENGTH ? sha256(token) : null
  return (req, _res, next) => {
    if (!expected) return next(new HttpError(403, 'FORBIDDEN', "Yozish o'chirilgan"))
    const match = /^Bearer\s+(\S+)$/.exec(req.get('authorization') || '')
    if (!match) return next(new HttpError(401, 'UNAUTHORIZED', 'Avtorizatsiya talab qilinadi'))
    // Teng uzunlikdagi xeshlar — timingSafeEqual uzunlik farqini ham sizdirmaydi
    if (!timingSafeEqual(sha256(match[1]), expected)) return next(new HttpError(403, 'FORBIDDEN', "Ruxsat yo'q"))
    next()
  }
}

/** IP bo'yicha daqiqalik limit (xotirada, har instansiyaga alohida). */
export function limiter(limit) {
  const tooMany = new HttpError(429, 'RATE_LIMITED', "So'rovlar juda ko'p, birozdan keyin urining")
  return rateLimit({
    windowMs: RATE_WINDOW_MS,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(tooMany),
  })
}

/** Production'da faqat 5xx loglanadi; query (qidiruv matni) logga yozilmaydi. */
export function requestLogger(logger, production) {
  return (req, res, next) => {
    const started = Date.now()
    res.on('finish', () => {
      const line = `${req.method} ${req.path} ${res.statusCode} ${Date.now() - started}ms`
      if (res.statusCode >= 500) logger.error(line)
      else if (!production) logger.info(line)
    })
    next()
  }
}

export function applySecurity(app, { env, rateLimits }) {
  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.set('query parser', 'simple')
  app.use(helmet({ contentSecurityPolicy: { useDefaults: false, directives: CSP_DIRECTIVES } }))
  const origins = parseOrigins(env.ALLOWED_ORIGINS)
  app.use(
    cors({
      origin: (origin, cb) => cb(null, Boolean(origin) && origins.has(origin)),
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  )
  app.use('/api', limiter(rateLimits.api), (_req, res, next) => {
    res.set('X-Robots-Tag', 'noindex')
    next()
  })
  // SEO sahifalari crawlerlar uchun ochiq, lekin qattiqroq alohida limit bilan
  app.use(SEO_PATHS, limiter(rateLimits.seo))
}
