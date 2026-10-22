// Score marshrutlari: kunlar, o'yinlar, featured, detal sahifalar (match/team/player/...), rasm proksisi.
// Detal javoblari (shu jumladan meta.unavailable) adapterdan o'zgarmasdan uzatiladi.
import { NotFoundError } from '../../errors.js'
import { router } from '../errors.js'
import { REAL_ID, idValidator, oneOf, optDate, optText, required } from '../validate.js'

const STATUSES = new Set(['all', 'live', 'ft', 'sched'])
const IMG_KINDS = new Set(['team', 'player', 'tournament', 'manager', 'referee'])
const RANKING_KINDS = new Set(['fifa', 'uefa'])
// SVG ataylab yo'q: API domenida skript bajarishi mumkin
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])
const MIME_RE = /^\s*([^;\s]+)/
const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const IMAGE_CACHE = 'public, max-age=86400'
const ENTITY_ROUTES = [
  ['/api/matches/:id', 'matchDetail', "O'yin"],
  ['/api/teams/:id', 'team', 'Jamoa'],
  ['/api/players/:id', 'player', "O'yinchi"],
  ['/api/players/:id/career', 'playerCareer', 'Karyera'],
  ['/api/coaches/:id', 'coach', 'Murabbiy'],
  ['/api/referees/:id', 'referee', 'Hakam'],
]

const defaultPickFeatured = matches => matches.find(m => m?.status === 'live') ?? null

export function registerScore(app, { sofa, idRe }) {
  const r = router(app)
  const id = idValidator(idRe)
  const today = () => sofa.days().today
  // Uydirma fallback yo'q: jonli o'yin bo'lmasa — null (tanlov qoidasi adapterda)
  const pickFeatured = typeof sofa.pickFeatured === 'function' ? sofa.pickFeatured : defaultPickFeatured

  r.get('/api/days', (_req, res) => res.json(sofa.days()))
  r.get('/api/scorers', async (req, res) => res.json(await sofa.scorers(optDate(req.query.date, today))))
  r.get('/api/standings-mini', async (req, res) => res.json(await sofa.standingsMini(optDate(req.query.date, today))))
  r.get('/api/matches', async (req, res) => {
    const date = optDate(req.query.date, today)
    const status = req.query.status === undefined ? 'all' : oneOf(STATUSES, req.query.status, 'status')
    const term = optText(req.query.q, 'q').toLowerCase()
    const league = req.query.league === undefined ? '' : id(req.query.league, 'league')
    const result = await sofa.matchesForDate(date) // { matches, partial }
    const matches = result.matches
      .filter(m => status === 'all' || m.status === status)
      .filter(m => !league || String(m.leagueId) === league)
      .filter(m => !term || `${m.home?.n ?? ''} ${m.away?.n ?? ''}`.toLowerCase().includes(term))
    const liveCount = matches.filter(m => m.status === 'live').length
    res.json({ date, matches, liveCount, partial: result.partial === true })
  })
  r.get('/api/featured', async (_req, res) => res.json(pickFeatured(await sofa.matchesByDate(today()))))
}

export function registerEntities(app, { sofa, idRe }) {
  const r = router(app)
  const id = idValidator(idRe)
  for (const [path, fn, what] of ENTITY_ROUTES) {
    r.get(path, async (req, res) => res.json(required(await sofa[fn](id(req.params.id)), what)))
  }
  r.get('/api/players/:id/season', async (req, res) => {
    const data = await sofa.playerSeason(id(req.params.id), id(req.query.tid, 'tid'), id(req.query.sid, 'sid'))
    res.json(required(data, 'Mavsum statistikasi'))
  })
  r.get('/api/leagues/:id', async (req, res) => {
    const season = req.query.season === undefined ? undefined : id(req.query.season, 'season')
    const data = await sofa.league(id(req.params.id), season)
    res.json(required(data?.league ? data : null, 'Liga'))
  })
  r.get('/api/countries', async (_req, res) => res.json({ countries: await sofa.countries() }))
  r.get('/api/countries/:id/leagues', async (req, res) => {
    res.json({ leagues: await sofa.countryLeagues(id(req.params.id)) })
  })
  r.get('/api/rankings/:kind', async (req, res) => {
    res.json({ rows: await sofa.rankings(oneOf(RANKING_KINDS, req.params.kind, 'reyting turi')) })
  })
}

// Rasm proksisi: faqat oq ro'yxatdagi image/* (FIX-PLAN 2.2), boshqa holatda 404
export function registerImage(app, { sofa, logger }) {
  router(app).get('/api/img/:kind/:id', async (req, res) => {
    const kind = oneOf(IMG_KINDS, req.params.kind, 'rasm turi')
    const id = idValidator(REAL_ID)(req.params.id)
    let img
    try {
      img = await sofa.fetchImage(kind, id)
    } catch (err) {
      if (!(err instanceof NotFoundError)) logger.warn(`[img] ${kind}/${id}: ${err.message}`)
      return res.status(404).end()
    }
    const type = (MIME_RE.exec(String(img?.type ?? ''))?.[1] ?? '').toLowerCase()
    if (!IMAGE_TYPES.has(type) || !Buffer.isBuffer(img.buf) || img.buf.length > MAX_IMAGE_BYTES) {
      return res.status(404).end()
    }
    res.set({
      'Content-Type': type,
      'Cache-Control': IMAGE_CACHE,
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'cross-origin', // frontend boshqa domendan <img> bilan oladi
    })
    res.send(img.buf)
  })
}
