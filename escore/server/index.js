// eSOCRE backend — REST API. Frontenddagi generatorlarni qayta ishlatadi.
import express from 'express'
import cors from 'cors'

import { ISSUE, TICKER, STANDINGS, RESULTS, FIXTURES, BRIEFS, QUOTE } from '../src/data/news.js'
import { TODAY, DAYS, LEAGUES, SCORERS, STANDINGS_MINI } from '../src/data/score.js'
import { getMatchDetails } from '../src/data/matchDetails.js'
import { getLeagueTable, getLeagueScorers } from '../src/data/leagueData.js'
import { getTeam } from '../src/data/teamData.js'
import { getPlayer } from '../src/data/playerData.js'
import { getCoach } from '../src/data/coachData.js'
import { getReferee } from '../src/data/refereeData.js'

import * as live from './live.js'
import * as store from './store.js'
import * as sofa from './sofascore.js'
import * as archive from './archive.js'

const app = express()
const PORT = process.env.PORT || 4500

// SofaScore real ma'lumotidan foydalanish (xato bo'lsa demo'ga qaytamiz)
const USE_REAL = process.env.USE_REAL !== '0'

// Real manbadan olishga urinadi; muvaffaqiyatsiz bo'lsa demo qiymatni qaytaradi
async function realOrDemo(label, fn, demo) {
  if (!USE_REAL) return demo
  try {
    return await fn()
  } catch (e) {
    console.warn(`[fallback] ${label}: ${e.message} → demo`)
    return demo
  }
}

app.use(cors())
app.use(express.json())

// kichik so'rov logi
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.url}`)
  next()
})

const ok = (res, data) => res.json(data)
const notFound = (res, msg = 'Topilmadi') => res.status(404).json({ error: msg })

// ---- Asosiy ----
app.get('/api/health', (_req, res) => ok(res, { ok: true, time: new Date().toISOString() }))

app.get('/api/bootstrap', (_req, res) =>
  ok(res, { issue: ISSUE, ticker: TICKER, today: TODAY, days: DAYS, leagues: LEAGUES })
)

// ---- Bosh sahifa (gazeta) — real yangiliklar + jadval/natija/fikstura ----
app.get('/api/home', async (_req, res) => {
  const real = await realOrDemo('home', () => sofa.home(), null)
  const base = { issue: ISSUE, quote: QUOTE }

  if (real && real.lead) {
    // Bo'sh qolgan bo'limlarni demo bilan to'ldiramiz
    if (!real.standings?.length) real.standings = STANDINGS
    if (!real.results?.length) real.results = RESULTS
    if (!real.fixtures?.length) real.fixtures = FIXTURES
    if (!real.ticker?.length) real.ticker = TICKER
    if (!real.briefs?.length) real.briefs = BRIEFS
    return ok(res, { ...base, ...real })
  }

  // To'liq demo zaxira
  const { lead, secondary, columns } = store.homeBlocks()
  ok(res, {
    ...base, ticker: TICKER,
    lead, secondary, columns,
    briefs: BRIEFS, standings: STANDINGS, results: RESULTS, fixtures: FIXTURES,
  })
})

// ---- Yangiliklar (CRUD) ----
app.get('/api/news', (_req, res) => ok(res, store.listArticles()))
app.get('/api/news/:slug', (req, res) => {
  const a = store.getArticle(req.params.slug)
  return a ? ok(res, a) : notFound(res, 'Maqola topilmadi')
})
app.post('/api/news', (req, res) => {
  try { ok(res, store.createArticle(req.body)) }
  catch (e) { res.status(400).json({ error: e.message }) }
})
app.put('/api/news/:slug', (req, res) => {
  const a = store.updateArticle(req.params.slug, req.body)
  return a ? ok(res, a) : notFound(res, 'Maqola topilmadi')
})
app.delete('/api/news/:slug', (req, res) => {
  return store.deleteArticle(req.params.slug)
    ? ok(res, { deleted: true })
    : notFound(res, 'Maqola topilmadi')
})

// ---- Qidiruv (maqolalar) ----
app.get('/api/search', (req, res) => ok(res, { articles: store.searchArticles(req.query.q) }))

// ---- Yangiliklar lentasi (SofaScore, o'zbekchaga tarjima) ----
app.get('/api/feed', async (req, res) => {
  const date = req.query.date || sofa.days().today
  const items = await realOrDemo('feed', () => sofa.news(date), [])
  if (items.length) archive.saveCards(items) // har lentada arxivga qo'shamiz
  ok(res, { items })
})

// ---- Bitta maqola (to'liq matn, o'z saytimizda) ----
app.get('/api/feed/:slug', async (req, res) => {
  let data = await realOrDemo('article', () => sofa.article(req.params.slug), null)
  if (data) {
    archive.saveArticle(data) // to'liq matnni arxivlaymiz
  } else {
    data = archive.getArticle(req.params.slug) // SofaScore'da yo'q bo'lsa arxivdan
  }
  return data ? ok(res, data) : notFound(res, 'Maqola topilmadi')
})

// ---- Davlatlar + ularning ligalari + reyting (yon panel uchun) ----
app.get('/api/countries', async (_req, res) => {
  ok(res, { countries: await realOrDemo('countries', () => sofa.countries(), []) })
})
app.get('/api/countries/:id/leagues', async (req, res) => {
  ok(res, { leagues: await realOrDemo('country-leagues', () => sofa.countryLeagues(req.params.id), []) })
})
app.get('/api/rankings/:kind', async (req, res) => {
  ok(res, { rows: await realOrDemo('rankings', () => sofa.rankings(req.params.kind), []) })
})

// ---- Arxiv (qidiruv + kategoriya + sahifalash) ----
app.get('/api/archive', (req, res) => {
  const { q, category, page } = req.query
  ok(res, archive.list({ q: q || '', category: category || '', page: parseInt(page) || 0 }))
})

// ---- Score (jonli) ----
app.get('/api/days', (_req, res) =>
  ok(res, USE_REAL ? sofa.days() : { today: TODAY, days: DAYS })
)
app.get('/api/scorers', async (req, res) => {
  const date = req.query.date || sofa.days().today
  ok(res, await realOrDemo('scorers', () => sofa.scorers(date), SCORERS))
})
app.get('/api/standings-mini', async (req, res) => {
  const date = req.query.date || sofa.days().today
  ok(res, await realOrDemo('standings-mini', () => sofa.standingsMini(date), STANDINGS_MINI))
})

app.get('/api/matches', async (req, res) => {
  const { date, status, q, league } = req.query
  const term = (q || '').toLowerCase()
  const day = date || sofa.days().today
  let list = await realOrDemo('matches', () => sofa.matchesByDate(day),
    live.getAll().filter((m) => !date || m.date === date))
  if (status && status !== 'all') list = list.filter((m) => m.status === status)
  if (league) list = list.filter((m) => m.leagueId === league)
  if (term) list = list.filter((m) => (m.home.n + ' ' + m.away.n).toLowerCase().includes(term))
  const liveCount = list.filter((m) => m.status === 'live').length
  ok(res, { matches: list, liveCount })
})

app.get('/api/featured', async (_req, res) => {
  const fallback = live.getOne('m1')
  const result = await realOrDemo('featured', async () => {
    const list = await sofa.matchesByDate(sofa.days().today)
    return list.find((m) => m.status === 'live') || list[0] || fallback
  }, fallback)
  ok(res, result)
})

app.get('/api/matches/:id', async (req, res) => {
  const demo = () => {
    const details = getMatchDetails(req.params.id)
    if (details) {
      const lm = live.getOne(req.params.id)
      if (lm) details.match = { ...details.match, minute: lm.minute, status: lm.status }
    }
    return details
  }
  const details = await realOrDemo('match-detail', () => sofa.matchDetail(req.params.id), demo())
  if (!details) return notFound(res, 'O\'yin topilmadi')
  ok(res, details)
})

// ---- Ligalar ----
app.get('/api/leagues', (_req, res) => ok(res, LEAGUES))
app.get('/api/leagues/:id', async (req, res) => {
  const demo = () => {
    const table = getLeagueTable(req.params.id)
    if (!table.league) return null
    const matches = live.getAll().filter((m) => m.leagueId === req.params.id)
    return { ...table, scorers: getLeagueScorers(req.params.id), matches }
  }
  const season = req.query.season || undefined
  const data = await realOrDemo('league', () => sofa.league(req.params.id, season), demo())
  if (!data || !data.league) return notFound(res, 'Liga topilmadi')
  ok(res, data)
})

// ---- Jamoa / O'yinchi / Murabbiy / Hakam (real, ID-asosli) ----
app.get('/api/teams/:id', async (req, res) => {
  const data = await realOrDemo('team', () => sofa.team(req.params.id), null)
  return data ? ok(res, data) : notFound(res, 'Jamoa topilmadi')
})
app.get('/api/players/:id', async (req, res) => {
  const data = await realOrDemo('player', () => sofa.player(req.params.id), null)
  return data ? ok(res, data) : notFound(res, 'O\'yinchi topilmadi')
})
app.get('/api/players/:id/career', async (req, res) => {
  ok(res, await realOrDemo('career', () => sofa.playerCareer(req.params.id), { isGK: false, rows: [] }))
})
app.get('/api/players/:id/season', async (req, res) => {
  const { tid, sid } = req.query
  if (!tid || !sid) return notFound(res, 'tid/sid kerak')
  ok(res, await realOrDemo('player-season', () => sofa.playerSeason(req.params.id, tid, sid), null))
})
app.get('/api/coaches/:id', async (req, res) => {
  const data = await realOrDemo('coach', () => sofa.coach(req.params.id), null)
  return data ? ok(res, data) : notFound(res, 'Murabbiy topilmadi')
})
app.get('/api/referees/:id', async (req, res) => {
  const data = await realOrDemo('referee', () => sofa.referee(req.params.id), null)
  return data ? ok(res, data) : notFound(res, 'Hakam topilmadi')
})

// ---- Rasm proksisi (logo/o'yinchi/turnir/murabbiy/hakam) ----
const IMG_KINDS = new Set(['team', 'player', 'tournament', 'manager', 'referee'])
app.get('/api/img/:kind/:id', async (req, res) => {
  const { kind, id } = req.params
  if (!IMG_KINDS.has(kind)) return notFound(res, 'Noma\'lum rasm turi')
  try {
    const { buf, type } = await sofa.fetchImage(kind, id)
    res.set('Content-Type', type)
    res.set('Cache-Control', 'public, max-age=86400')
    res.send(buf)
  } catch {
    res.status(404).end()
  }
})

// ---- Ildiz: endpointlar ro'yxati ----
app.get('/', (_req, res) => {
  res.type('html').send(`<pre style="font:14px monospace;padding:20px">
eSOCRE API — ishlayapti ⚽

GET  /api/health
GET  /api/bootstrap
GET  /api/home
GET  /api/news            GET /api/news/:slug
POST /api/news            PUT /api/news/:slug    DELETE /api/news/:slug
GET  /api/search?q=
GET  /api/matches?date=&status=&q=&league=
GET  /api/matches/:id
GET  /api/leagues         GET /api/leagues/:id
GET  /api/teams/:name
GET  /api/players/:team/:name?pos=
GET  /api/coaches/:team/:name
GET  /api/referees/:name
GET  /api/scorers  /api/standings-mini  /api/featured  /api/days
</pre>`)
})

app.use((_req, res) => notFound(res))

live.startEngine(8000)
app.listen(PORT, () => console.log(`eSOCRE API → http://localhost:${PORT}`))
