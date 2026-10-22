// Reklama joyi (placeholder). Keyinchalik banner rasm bilan to'ldiriladi.
// Foydalanish: <AdSlot /> yoki <AdSlot href="https://..." img="/banner.jpg" alt="..." />
// Ildiz oddiy <div>: sahifada bir nechta reklama bo'lsa landmark takrorlanmasin.
import { safeUrl } from '../lib/format.js'

const DEFAULT_HEIGHT = 300
const AD_LABEL = 'Reklama'
// Sayt ichidagi mutlaq yo'l: `/banner.jpg`, lekin `//host` yoki `/\host` (protokolsiz tashqi manzil) emas
const LOCAL_PATH_RE = /^\/(?![/\\])/

function safeImageSrc(src) {
  if (typeof src === 'string' && LOCAL_PATH_RE.test(src)) return src
  return safeUrl(src)
}

export default function AdSlot({ label = AD_LABEL, img, href, alt = '', height = DEFAULT_HEIGHT }) {
  const src = safeImageSrc(img)
  const link = safeUrl(href)
  if (src) {
    const banner = <img className="ad-slot__img" src={src} alt={alt} loading="lazy" decoding="async" />
    return (
      <div className="ad-slot ad-slot--filled" style={{ minHeight: height }}>
        <span className="sr-only">{AD_LABEL}</span>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer sponsored"
            aria-label={alt ? undefined : `${AD_LABEL} (yangi oynada)`}
          >
            {banner}
          </a>
        ) : (
          banner
        )}
      </div>
    )
  }
  return (
    <div className="ad-slot" style={{ minHeight: height }}>
      <span className="ad-slot__tag">{String(label).toUpperCase()}</span>
      <span className="ad-slot__hint">Banner joyi</span>
    </div>
  )
}
