// Maqola sahifalari uchun SEO yordamchilari: ISO sana va NewsArticle JSON-LD
import { siteUrl, SITE_NAME } from '../../lib/seo.js'
import { safeUrl } from '../../lib/format.js'

const LOGO_PATH = '/icon-512.png'

/**
 * Sana qiymatini ISO 8601 ga aylantiradi; tushunib bo'lmasa undefined (JSON-LD da maydon chiqmaydi).
 * @param {unknown} value
 * @returns {string|undefined}
 */
export function isoDate(value) {
  if (value == null || value === '') return undefined
  const d = new Date(typeof value === 'number' && value < 1e12 ? value * 1000 : value)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

/**
 * schema.org NewsArticle obyekti.
 * @param {{ headline: string, description?: string, image?: string, date?: unknown, author?: string, path: string }} a
 */
export function newsArticleJsonLd({ headline, description, image, date, author, path }) {
  const img = safeUrl(image)
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline,
    description: description || undefined,
    image: img ? [img] : undefined,
    datePublished: isoDate(date),
    author: author ? { '@type': 'Person', name: author } : { '@type': 'Organization', name: SITE_NAME },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: siteUrl() + LOGO_PATH },
    },
    mainEntityOfPage: siteUrl() + path,
    inLanguage: 'uz',
  }
}

/**
 * Yangilikni ulashish havolasi: backend OG sahifasi (Telegram/Facebook preview uchun),
 * API manzili sozlanmagan bo'lsa sahifaning canonical URL i.
 * @param {string|null} apiBase
 * @param {string} slug
 */
export function newsShareUrl(apiBase, slug) {
  const enc = encodeURIComponent(slug)
  return apiBase ? `${apiBase}/share/news/${enc}` : `${siteUrl()}/news/${enc}`
}
