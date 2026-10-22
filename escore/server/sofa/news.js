// Yangiliklar (sofascore.com/news tahririyat maqolalari, o'zbekchaga tarjima) va bosh sahifa.

import { NotFoundError, UpstreamError } from '../errors.js'
import { translateBatch } from '../translate.js'
import { days } from './dates.js'
import { dominantStandingRows, matchesForDate } from './events.js'
import { arr } from './format.js'
import { j } from './http.js'
import { logPartial } from './log.js'

const NEWS_LIMIT = 18
const HOME_STANDINGS_LIMIT = 6
const HOME_LIST_LIMIT = 6
const HOUR_S = 3600
const DAY_S = 86_400
const MINUTE_S = 60

function relativeFromDate(iso) {
  const ms = new Date(iso).getTime()
  if (!Number.isFinite(ms)) return ''
  const delta = Math.floor(Date.now() / 1000 - ms / 1000)
  const diff = Math.abs(delta)
  const suffix = delta < 0 ? 'keyin' : 'oldin' // kelajak sana (soat farqi) — "keyin"
  if (diff < HOUR_S) return `${Math.max(1, Math.floor(diff / MINUTE_S))} daqiqa ${suffix}`
  if (diff < DAY_S) return `${Math.floor(diff / HOUR_S)} soat ${suffix}`
  return `${Math.floor(diff / DAY_S)} kun ${suffix}`
}

const CAT_LABELS = new Map([
  ['world-cup', 'Jahon chempionati'],
  ['champions-league', 'Chempionlar ligasi'],
  ['europa-league', 'Yevropa ligasi'],
  ['premier-league', 'Premyer-liga'],
  ['la-liga', 'La Liga'],
  ['serie-a', 'Seriya A'],
  ['bundesliga', 'Bundesliga'],
  ['transfers', 'Transfer'],
  ['transfer', 'Transfer'],
  ['fantasy', 'Fantasy'],
])

function catLabel(cats) {
  for (const c of arr(cats)) if (CAT_LABELS.has(c)) return CAT_LABELS.get(c)
  return null // toifa noma'lum — frontend umumiy so'z qo'yadi
}

export async function news() {
  // sofascore.com/news dan futbol maqolalarini olamiz (FastAPI HTML ni parse qiladi)
  const data = await j('/news')
  const posts = arr(data.posts)
    .filter(p => p?.section === 'football' && p.image && p.title)
    .slice(0, NEWS_LIMIT)

  // har maqola sarlavhasi + excerpti — parallel; translationComplete har maqola uchun alohida
  const tr = await Promise.all(posts.map(p => translateBatch([p.title, p.excerpt])))

  return posts.map((p, i) => ({
    id: p.id,
    slug: p.slug,
    title: tr[i].texts[0] || p.title,
    subtitle: tr[i].texts[1] || p.excerpt,
    image: p.image,
    url: p.url,
    isVideo: false,
    league: catLabel(p.categories),
    source: 'SofaScore',
    date: p.date,
    time: relativeFromDate(p.date),
    translationComplete: tr[i].complete,
  }))
}

// ---- Bitta maqola (to'liq matn, o'zbekchaga tarjima). Sarlavhasiz → NotFoundError ----
export async function article(slug) {
  const a = await j(`/news/${encodeURIComponent(slug)}`)
  if (typeof a.title !== 'string' || !a.title.trim()) throw new NotFoundError(`maqola topilmadi: ${slug}`)
  const blocks = arr(a.blocks).filter(b => b && typeof b.text === 'string' && b.text.trim())
  // sarlavha + qisqacha + barcha bloklar matnini bitta to'plamda tarjima qilamiz
  const tr = await translateBatch([a.title, a.excerpt, ...blocks.map(b => b.text)])
  return {
    id: a.id,
    slug: a.slug,
    title: tr.texts[0] || a.title,
    excerpt: tr.texts[1] || a.excerpt || '',
    image: a.image,
    author: a.author,
    league: catLabel(a.categories),
    date: a.date,
    time: relativeFromDate(a.date),
    blocks: blocks.map((b, i) => ({ type: b.type, text: tr.texts[i + 2] || b.text })),
    sourceUrl: a.url,
    translationComplete: tr.complete,
  }
}

// ---- Bosh sahifa (gazeta) — real yangiliklar + jadval + natija + fikstura ----
async function homeStandings(date) {
  const rows = await dominantStandingRows(date)
  return rows.slice(0, HOME_STANDINGS_LIMIT).map(r => ({
    pos: r.position,
    club: r.team?.shortName || r.team?.name || '',
    p: r.matches ?? null,
    w: r.wins ?? null,
    d: r.draws ?? null,
    l: r.losses ?? null,
    pts: r.points ?? null,
  }))
}

// Maqolani gazeta blokiga aylantiramiz (ICHKI havola + rasm)
function toStory(a) {
  return {
    slug: a.slug,
    href: `/news/${a.slug}`,
    image: a.image,
    kicker: a.league,
    title: a.title,
    standfirst: a.subtitle,
  }
}

function leadStory(a) {
  if (!a) return null
  return { ...toStory(a), photoTag: a.league, caption: a.subtitle, body: [a.subtitle] }
}

const SECTION_DEFAULTS = { news: [], matches: { matches: [], partial: false }, standings: [] }

/** Bo'limlar natijasi: muvaffaqiyatsizlari log qilinadi va `unavailable` ga yoziladi. */
function collectSections(settled) {
  const sections = { ...SECTION_DEFAULTS }
  const unavailable = []
  const errors = []
  for (const [name, res] of Object.entries(settled)) {
    if (res.status === 'fulfilled') {
      sections[name] = res.value
      continue
    }
    const err = res.reason
    if (!(err instanceof UpstreamError || err instanceof NotFoundError)) throw err // dasturiy xato
    logPartial(`home/${name}`, err)
    errors.push(err)
    unavailable.push(...(name === 'matches' ? ['results', 'fixtures'] : [name]))
  }
  if (errors.length === Object.keys(settled).length) {
    throw new UpstreamError('bosh sahifa manbalari ishlamadi', { cause: new AggregateError(errors, 'home') })
  }
  return { ...sections, unavailable }
}

/**
 * Bosh sahifa. Qisman xatoda mavjud bo'limlar qaytadi, `meta.unavailable` da yo'qlari;
 * barcha manbalar yiqilsa — UpstreamError.
 * meta.source: 'live' — yangiliklar SofaScore'dan; null — yangiliklar yuklanmadi (T-01 store bilan to'ldiradi).
 * meta.partial: o'yinlar ro'yxati qisman (live zaxirasi yoki UTC kunlaridan biri yo'q).
 */
export async function home() {
  const date = days().today
  const [newsRes, matchesRes, standRes] = await Promise.allSettled([news(), matchesForDate(date), homeStandings(date)])
  const s = collectSections({ news: newsRes, matches: matchesRes, standings: standRes })
  const articles = s.news
  const finished = s.matches.matches.filter(m => m.status === 'ft').slice(0, HOME_LIST_LIMIT)
  const upcoming = s.matches.matches.filter(m => m.status === 'sched').slice(0, HOME_LIST_LIMIT)

  return {
    lead: leadStory(articles[0]),
    secondary: articles.slice(1, 4).map(toStory),
    columns: articles.slice(4, 7).map(a => ({ ...toStory(a), author: a.source || 'SofaScore' })),
    briefs: articles.slice(7, 12).map(a => a.title),
    ticker: articles.slice(0, 8).map(a => a.title),
    standings: s.standings,
    results: finished.map(m => ({ home: m.home.n, hs: m.hs, as: m.as, away: m.away.n })),
    fixtures: upcoming.map(m => ({ time: m.time, ts: m.ts, home: m.home.n, away: m.away.n })),
    meta: {
      source: s.unavailable.includes('news') ? null : 'live',
      unavailable: s.unavailable,
      partial: s.matches.partial,
    },
  }
}
