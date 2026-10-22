// eSCORE backend — Express ilovasi (createApp). Tashqi bog'liqliklar (sofa, store, archive)
// deps orqali beriladi: index.js real/demo adapterni ulaydi, testlar mock beradi.
// Shartnoma: docs/FIX-PLAN.md §2. Qatlamlar: http/errors (xaritalash), http/validate,
// http/security (helmet/CORS/limit/auth), http/seo, http/routes/* (yupqa marshrutlar).
import express from 'express'

import { HttpError, errorHandler } from './http/errors.js'
import { DEMO_ID, REAL_ID } from './http/validate.js'
import { applySecurity, parseSiteUrl, requestLogger } from './http/security.js'
import { registerSeo } from './http/seo.js'
import { registerNews, registerFeed } from './http/routes/content.js'
import { registerScore, registerEntities, registerImage } from './http/routes/score.js'

export { HttpError } from './http/errors.js'
export { escapeHtml } from './http/seo.js'

// Daqiqalik limitlar (IP bo'yicha): umumiy API, yozish, SEO sahifalari (/share, /sitemap.xml)
const DEFAULT_RATE_LIMITS = { api: 300, write: 20, seo: 60 }
const REGISTRARS = [registerNews, registerFeed, registerScore, registerEntities, registerImage, registerSeo]

/**
 * @param {{ sofa: object, store: object, archive: object, mode?: 'real'|'demo',
 *   env?: Record<string, string|undefined>, logger?: Pick<Console, 'info'|'warn'|'error'>,
 *   rateLimits?: { api?: number, write?: number, seo?: number } }} deps
 * @returns {import('express').Express}
 */
export function createApp({ sofa, store, archive, mode = 'real', env = process.env, logger = console, rateLimits }) {
  if (!sofa || !store || !archive) throw new Error('createApp: sofa, store va archive majburiy')
  const ctx = {
    sofa,
    store,
    archive,
    mode,
    env,
    logger,
    idRe: mode === 'demo' ? DEMO_ID : REAL_ID,
    siteUrl: parseSiteUrl(env.SITE_URL),
    rateLimits: { ...DEFAULT_RATE_LIMITS, ...rateLimits },
  }
  const app = express()
  app.use(requestLogger(logger, env.NODE_ENV === 'production'))
  applySecurity(app, ctx)
  for (const register of REGISTRARS) register(app, ctx)
  app.get('/', (_req, res) => res.type('text').send("eSCORE API ishlayapti. Sog'lik: /api/health\n"))
  app.use((_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'Topilmadi')))
  app.use(errorHandler(logger))
  return app
}
