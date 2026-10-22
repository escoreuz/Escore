// Sahifa SEO meta teglari: title, description, canonical, Open Graph, Twitter, JSON-LD, robots
import { useEffect } from 'react'

export const SITE_NAME = 'eSCORE'
export const DEFAULT_TITLE = "eSCORE — o'zbek tilidagi futbol gazetasi"
export const DEFAULT_DESCRIPTION =
  "eSCORE — futbol yangiliklari gazetasi. So'nggi xabarlar, tahlillar, transferlar va natijalar."
export const DEFAULT_IMAGE = '/og-default.png'
const DEFAULT_IMAGE_WIDTH = '1200'
const DEFAULT_IMAGE_HEIGHT = '630'
const JSON_LD_ID = 'seo-jsonld'

/** Sayt manzili: VITE_SITE_URL yoki joriy origin (oxirgi `/` siz). */
export function siteUrl() {
  const raw = import.meta.env.VITE_SITE_URL || window.location.origin
  return String(raw).replace(/\/+$/, '')
}

// Nisbiy yo'lni mutlaq URL ga aylantiradi; mutlaq http(s) o'zgarmaydi
function absoluteUrl(pathOrUrl) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : '/' + pathOrUrl
  return siteUrl() + path
}

function upsertMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function removeMeta(attr, key) {
  document.head.querySelector(`meta[${attr}="${key}"]`)?.remove()
}

function upsertCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

// `</script>` orqali chiqib ketishning oldini olish uchun `<` escape qilinadi
function serializeJsonLd(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

function setJsonLd(data) {
  document.getElementById(JSON_LD_ID)?.remove()
  if (!data) return
  const el = document.createElement('script')
  el.type = 'application/ld+json'
  el.id = JSON_LD_ID
  el.textContent = serializeJsonLd(data)
  document.head.appendChild(el)
}

/**
 * Meta teglarni DOM'ga yozadi (hook'siz — test va SSR-siz ishlatish uchun).
 * @param {{ title?: string, description?: string, image?: string, path?: string,
 *   type?: string, jsonLd?: object, noindex?: boolean }} opts
 */
export function applySeo({ title, description, image, path, type = 'website', jsonLd, noindex = false } = {}) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE
  const desc = description || DEFAULT_DESCRIPTION
  const url = absoluteUrl(path || window.location.pathname)
  const img = absoluteUrl(image || DEFAULT_IMAGE)

  document.title = fullTitle
  upsertMeta('name', 'description', desc)
  upsertCanonical(url)
  upsertMeta('property', 'og:title', fullTitle)
  upsertMeta('property', 'og:description', desc)
  upsertMeta('property', 'og:type', type)
  upsertMeta('property', 'og:url', url)
  upsertMeta('property', 'og:image', img)
  // O'lcham faqat standart rasm uchun ma'lum; maqola rasmi o'lchami noma'lum — teg olib tashlanadi
  if (image) {
    removeMeta('property', 'og:image:width')
    removeMeta('property', 'og:image:height')
  } else {
    upsertMeta('property', 'og:image:width', DEFAULT_IMAGE_WIDTH)
    upsertMeta('property', 'og:image:height', DEFAULT_IMAGE_HEIGHT)
  }
  upsertMeta('name', 'twitter:card', 'summary_large_image')
  upsertMeta('name', 'twitter:title', fullTitle)
  upsertMeta('name', 'twitter:description', desc)
  upsertMeta('name', 'twitter:image', img)
  if (noindex) upsertMeta('name', 'robots', 'noindex, follow')
  else removeMeta('name', 'robots')
  setJsonLd(jsonLd)
}

/**
 * Sahifa SEO hook'i. Har sahifa bir marta chaqiradi.
 * `jsonLd` obyekti har renderda yangi bo'lsa ham effekt faqat mazmun o'zgarganda qayta ishlaydi.
 */
export function useSeo({ title, description, image, path, type = 'website', jsonLd, noindex = false } = {}) {
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : ''
  useEffect(() => {
    applySeo({ title, description, image, path, type, jsonLd: jsonLdKey ? JSON.parse(jsonLdKey) : null, noindex })
    // Unmountda sahifaga xos qoldiqlar tozalanadi: noindex keyingi sahifaga "yopishib" qolmasin.
    // title/description/canonical/og ni keyingi sahifa o'z useSeo'si bilan qayta yozadi.
    return () => {
      setJsonLd(null)
      removeMeta('name', 'robots')
    }
  }, [title, description, image, path, type, jsonLdKey, noindex])
}
