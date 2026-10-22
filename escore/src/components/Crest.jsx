import { useState } from 'react'
import { api } from '../api.js'
import { initials } from '../lib/format.js'
import { readableTextColor } from '../lib/color.js'

// Rasmning tabiiy o'lchami (px) — styles.css dagi .sc-badge o'lchamlariga mos (CLS oldini olish uchun)
const SIZE_PX = { lg: 46, sm: 20, md: 22 }
const IMG_STYLE = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  background: '#fff',
}

// Logo/rasmli badge. id bo'lsa rasm yuklanadi; xato bo'lsa rangli initsiallarga qaytadi.
// Dekorativ: yonida doim nom matni bo'ladi, shuning uchun ekran o'quvchidan yashiriladi.
// kind: 'team' | 'player' | 'manager' | 'referee' | 'tournament'
export default function Crest({ name, c = '#444', id, kind = 'team', size }) {
  const [failedSrc, setFailedSrc] = useState(null)
  const sizeKey = size === 'lg' || size === 'sm' ? size : 'md'
  const cls = `sc-badge${sizeKey === 'md' ? '' : ` sc-badge--${sizeKey}`}`
  const src = id ? api.img(kind, id) : null
  const px = SIZE_PX[sizeKey]
  // Jamoa rangi fon bo'lganda initsiallar WCAG AA kontrast bilan (qora/oq); tanilmagan rangda CSS rangi qoladi
  const style = { background: c, color: readableTextColor(c) ?? undefined, position: 'relative', overflow: 'hidden' }
  return (
    <span className={cls} style={style} aria-hidden="true">
      {initials(name)}
      {src && src !== failedSrc && (
        <img
          src={src}
          alt=""
          width={px}
          height={px}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src)}
          style={IMG_STYLE}
        />
      )}
    </span>
  )
}
