// Kontent marshrutlari: health/bootstrap/home, tahririyat maqolalari (CRUD), lenta va arxiv.
import express from 'express'

import { UpstreamError, NotFoundError } from '../../errors.js'
import { HttpError, router } from '../errors.js'
import { requireAdmin, limiter } from '../security.js'
import { optPage, optText, publicArticle, required, slugParam } from '../validate.js'

const JSON_BODY_LIMIT = '100kb'
const TICKER_SIZE = 8
const HOME_DATA_SECTIONS = ['standings', 'results', 'fixtures']
const ISSUE = { volume: 'XII SON', no: '№ 247', city: 'TOSHKENT' }

const storeTitles = store =>
  store
    .listArticles()
    .map(a => a.title)
    .slice(0, TICKER_SIZE)

// Fon yozuvi (arxiv): javobni buzmaydi, lekin xato albatta log qilinadi
function bestEffort(logger, label, fn) {
  Promise.resolve()
    .then(fn)
    .catch(err => logger.error(`[${label}] ${err.message}`))
}

async function fetchHome(sofa, logger) {
  try {
    return await sofa.home()
  } catch (err) {
    if (!(err instanceof UpstreamError)) throw err
    logger.warn(`[home] manba ishlamayapti: ${err.message}`)
    return null
  }
}

/**
 * Bosh sahifa (FIX-PLAN 2.2): demo/uydirma real ma'lumotga aralashmaydi.
 * sofa.home() meta.source === null (yangiliklar yuklanmadi) yoki xato → yangilik bloklari store'dan.
 */
export async function buildHome({ sofa, store, mode, logger }) {
  const up = await fetchHome(sofa, logger)
  const unavailable = new Set(Array.isArray(up?.meta?.unavailable) ? up.meta.unavailable : [])
  const data = {}
  for (const key of HOME_DATA_SECTIONS) {
    data[key] = Array.isArray(up?.[key]) ? up[key] : []
    if (!up) unavailable.add(key)
  }
  const hasNews = Boolean(up?.lead) && up?.meta?.source !== null
  const news = hasNews
    ? { lead: up.lead, secondary: up.secondary ?? [], columns: up.columns ?? [] }
    : store.homeBlocks()
  const source = mode === 'demo' ? 'demo' : hasNews ? 'live' : 'store'
  return {
    ...news,
    briefs: (hasNews || mode === 'demo') && Array.isArray(up?.briefs) ? up.briefs : [],
    quote: up?.quote ?? null,
    ticker: hasNews && up.ticker?.length ? up.ticker : storeTitles(store),
    ...data,
    meta: { source, unavailable: [...unavailable], partial: up?.meta?.partial === true },
  }
}

export function registerNews(app, ctx) {
  const { store } = ctx
  const r = router(app)
  const admin = [
    limiter(ctx.rateLimits.write),
    requireAdmin(ctx.env.ADMIN_TOKEN, ctx.logger),
    express.json({ limit: JSON_BODY_LIMIT }), // body faqat avtorizatsiyadan keyin o'qiladi
  ]
  const validBody = (body, partial) => {
    const res = store.validateArticle(body, { partial })
    if (!res.ok) throw new HttpError(400, 'BAD_REQUEST', "Maqola ma'lumoti yaroqsiz", res.errors)
    return res.value
  }

  r.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }))
  r.get('/api/bootstrap', (_req, res) => res.json({ issue: ISSUE, ticker: storeTitles(store) }))
  r.get('/api/home', async (_req, res) => res.json(await buildHome(ctx)))
  r.get('/api/news', (_req, res) => res.json(store.listArticles()))
  r.get('/api/news/:slug', (req, res) => {
    res.json(publicArticle(required(store.getArticle(slugParam(req.params.slug)), 'Maqola')))
  })
  r.post('/api/news', ...admin, (req, res) => res.status(201).json(store.createArticle(validBody(req.body, false))))
  r.put('/api/news/:slug', ...admin, (req, res) => {
    const slug = slugParam(req.params.slug)
    res.json(required(store.updateArticle(slug, validBody(req.body, true)), 'Maqola'))
  })
  r.delete('/api/news/:slug', ...admin, (req, res) => {
    if (!store.deleteArticle(slugParam(req.params.slug))) throw new NotFoundError('Maqola topilmadi')
    res.json({ deleted: true })
  })
  r.get('/api/search', (req, res) => res.json({ articles: store.searchArticles(optText(req.query.q, 'q')) }))
}

export function registerFeed(app, { sofa, archive, logger }) {
  const r = router(app)
  r.get('/api/archive', async (req, res) => {
    const q = optText(req.query.q, 'q')
    const category = optText(req.query.category, 'category')
    res.json(await archive.list({ q, category, page: optPage(req.query.page) }))
  })
  r.get('/api/feed', async (_req, res) => {
    const items = await sofa.news()
    if (items.length) bestEffort(logger, 'archive.saveCards', () => archive.saveCards(items))
    res.json({ items })
  })
  r.get('/api/feed/:slug', async (req, res) => {
    const slug = slugParam(req.params.slug)
    let article
    try {
      article = publicArticle(required(await sofa.article(slug), 'Maqola'))
    } catch (err) {
      if (!(err instanceof UpstreamError || err instanceof NotFoundError)) throw err
      const cached = archive.getArticle(slug) // manbada yo'q/ishlamasa — arxivdan
      if (!cached) throw err
      return res.json(publicArticle(cached))
    }
    // Faqat to'liq tarjima qilingan maqola arxivlanadi
    if (article.translationComplete) bestEffort(logger, 'archive.saveArticle', () => archive.saveArticle(article))
    res.json(article)
  })
}
