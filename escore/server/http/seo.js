// SEO: /sitemap.xml (xotirada keshlanadi) va /share/news/:slug — OG/Twitter meta + yo'naltirish
// (Telegram preview uchun). Keshlar har ilova nusxasiga xos va hajmi chegaralangan.
import { NotFoundError } from '../errors.js'
import { router } from './errors.js'
import { SLUG_RE, required, safeHttpUrl, slugParam } from './validate.js'

const SITEMAP_TTL_MS = 10 * 60 * 1000
const SITEMAP_ARCHIVE_PAGE_SIZE = 50
const SITEMAP_MAX_ARCHIVE_PAGES = 40 // ≤ 2000 arxiv maqolasi
const SITEMAP_STATIC_PATHS = ['/', '/news', '/score', '/archive']
const NEGATIVE_TTL_MS = 5 * 60 * 1000
const NEGATIVE_MAX_ENTRIES = 500
const SHARE_CACHE = 'public, max-age=300'
const MAX_TITLE = 200
const MAX_DESCRIPTION = 300

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ESCAPES[c])
const clip = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '')

function isoDay(value) {
  const t = typeof value === 'string' || typeof value === 'number' ? new Date(value).getTime() : NaN
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10)
}

async function sitemapEntries({ store, archive, siteUrl }) {
  const entries = SITEMAP_STATIC_PATHS.map(p => ({ loc: siteUrl + p }))
  for (const a of store.listArticles()) {
    if (SLUG_RE.test(a.slug)) entries.push({ loc: `${siteUrl}/article/${a.slug}`, lastmod: isoDay(a.date) })
  }
  for (let page = 0; page < SITEMAP_MAX_ARCHIVE_PAGES; page++) {
    const { items, hasMore } = await archive.list({ page, size: SITEMAP_ARCHIVE_PAGE_SIZE })
    for (const it of items) {
      if (SLUG_RE.test(it.slug)) entries.push({ loc: `${siteUrl}/news/${it.slug}`, lastmod: isoDay(it.date) })
    }
    if (!hasMore) break
  }
  return entries
}

function sitemapXml(entries) {
  const urls = entries.map(e => {
    const lastmod = e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''
    return `<url><loc>${escapeHtml(e.loc)}</loc>${lastmod}</url>`
  })
  const ns = 'http://www.sitemaps.org/schemas/sitemap/0.9'
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="${ns}">\n${urls.join('\n')}\n</urlset>\n`
}

// Barcha qiymatlar escape qilinadi (maqola matni tashqi manbadan keladi)
function shareHtml(article, url) {
  const title = escapeHtml(clip(article.title, MAX_TITLE) || 'eSCORE')
  const desc = escapeHtml(clip(article.excerpt || article.subtitle || '', MAX_DESCRIPTION))
  const image = safeHttpUrl(article.image)
  const href = escapeHtml(url)
  const meta = [
    `<meta property="og:type" content="article">`,
    `<meta property="og:site_name" content="eSCORE">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${desc}">`,
    `<meta property="og:url" content="${href}">`,
    image ? `<meta property="og:image" content="${escapeHtml(image)}">` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${desc}">`,
    image ? `<meta name="twitter:image" content="${escapeHtml(image)}">` : '',
  ].filter(Boolean)
  return `<!doctype html>
<html lang="uz"><head><meta charset="utf-8">
<title>${title} | eSCORE</title>
<meta name="description" content="${desc}">
<meta name="robots" content="noindex">
<link rel="canonical" href="${href}">
${meta.join('\n')}
<meta http-equiv="refresh" content="0; url=${href}">
</head><body><p><a href="${href}">${title}</a></p></body></html>`
}

/** Chegaralangan negativ kesh: yo'q slug'lar upstream'ga qayta-qayta so'rov yubormasin. */
export function createNegativeCache({ ttlMs = NEGATIVE_TTL_MS, maxEntries = NEGATIVE_MAX_ENTRIES, now = Date.now }) {
  const entries = new Map() // slug → muddati tugash vaqti (qo'shilish tartibida)
  return {
    has(key) {
      const expires = entries.get(key)
      if (expires === undefined) return false
      if (expires > now()) return true
      entries.delete(key)
      return false
    },
    add(key) {
      entries.delete(key)
      if (entries.size >= maxEntries) entries.delete(entries.keys().next().value) // eng eskisi
      entries.set(key, now() + ttlMs)
    },
    delete: key => entries.delete(key),
    get size() {
      return entries.size
    },
  }
}

// Lokal arxiv har doim negativ keshdan oldin tekshiriladi: 404 keshlangandan keyin saqlangan
// maqola darhol ko'rinadi va slug keshdan o'chiriladi (kesh zaharlanmaydi).
// Store maqolalari /article/:slug da — bu /news ulashish sahifasiga kirmaydi.
async function findShareArticle({ archive, sofa }, slug, missing) {
  const cached = archive.getArticle(slug)
  if (cached) {
    missing.delete(slug)
    return cached
  }
  if (missing.has(slug)) throw new NotFoundError('Maqola topilmadi (kesh)')
  try {
    return required(await sofa.article(slug), 'Maqola')
  } catch (err) {
    if (err instanceof NotFoundError) missing.add(slug) // faqat haqiqiy 404; upstream xatosi keshlanmaydi
    throw err
  }
}

export function registerSeo(app, ctx) {
  const r = router(app)
  const now = ctx.now ?? Date.now
  const missing = createNegativeCache({ now })
  let sitemap = null // { xml, expires }

  r.get('/sitemap.xml', async (_req, res) => {
    if (!sitemap || sitemap.expires <= now()) {
      sitemap = { xml: sitemapXml(await sitemapEntries(ctx)), expires: now() + SITEMAP_TTL_MS }
    }
    res.type('application/xml').send(sitemap.xml)
  })
  r.get('/share/news/:slug', async (req, res) => {
    const slug = slugParam(req.params.slug)
    const article = await findShareArticle(ctx, slug, missing)
    res.type('html').set('Cache-Control', SHARE_CACHE)
    res.send(shareHtml(article, `${ctx.siteUrl}/news/${slug}`))
  })
}
