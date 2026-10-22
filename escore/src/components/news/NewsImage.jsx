// Yangilik rasmi: URL xavfsiz bo'lmasa yoki yuklanmasa buzilgan <img> o'rniga eSCORE belgisi chiqadi
import { useState } from 'react'
import { safeUrl } from '../../lib/format.js'

// Kartochka rasmlari uchun nisbat (16:9) — layout siljishining oldini oladi
export const IMAGE_WIDTH = 640
export const IMAGE_HEIGHT = 360

/**
 * @param {{ src?: string, alt?: string, className?: string, fallbackClassName?: string,
 *   eager?: boolean, width?: number, height?: number }} props
 */
export default function NewsImage({
  src,
  alt = '',
  className = 'nw-card__img',
  fallbackClassName = 'nw-card__noimg',
  eager = false,
  width = IMAGE_WIDTH,
  height = IMAGE_HEIGHT,
}) {
  const url = safeUrl(src)
  const [failed, setFailed] = useState(false)
  if (!url || failed) {
    // fallbackClassName={null} — o'rnini bo'sh qoldirish (masalan, ota blokda o'z bezagi bo'lsa)
    if (fallbackClassName === null) return null
    return (
      <span className={fallbackClassName} aria-hidden="true" data-testid="news-image-fallback">
        eSCORE
      </span>
    )
  }
  return (
    <img
      className={className}
      src={url}
      alt={alt}
      width={width}
      height={height}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : undefined}
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}
