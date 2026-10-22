// Yangilik kartasi (rasm + sarlavha) — News va Archive sahifalari uchun umumiy
import { Link } from '../../lib/nav.jsx'
import NewsImage from './NewsImage.jsx'
import { newsPath } from './paths.js'

/**
 * @param {{ item: { slug: string, title?: string, subtitle?: string, image?: string, league?: string,
 *   isVideo?: boolean }, big?: boolean, meta?: import('react').ReactNode[] }} props
 */
export default function NewsCard({ item, big = false, meta = [] }) {
  const to = newsPath(item.slug)
  const title = item.title || 'Sarlavhasiz maqola'
  return (
    <article className={`nw-card${big ? ' nw-card--lead' : ''}`}>
      {/* Rasm-havola sarlavha-havolani takrorlaydi — klaviatura va ekran o'quvchidan yashiriladi */}
      <Link className="nw-card__media" to={to} tabIndex={-1} aria-hidden="true">
        <NewsImage src={item.image} alt={title} eager={big} />
        {item.isVideo && <span className="nw-card__play">▶</span>}
        {item.league && <span className="nw-card__league">{item.league}</span>}
      </Link>
      <div className="nw-card__body">
        <Link to={to} className="nw-card__title">
          {title}
        </Link>
        {item.subtitle && <p className="nw-card__sub">{item.subtitle}</p>}
        <div className="nw-card__meta">
          {/* Liga yorlig'i rasm ustida (aria-hidden) — ekran o'quvchi uchun shu yerda takrorlanadi */}
          {item.league && <span className="sr-only">Liga: {item.league}</span>}
          <span>{meta[0] ?? '—'}</span>
          <span>{meta[1] ?? '—'}</span>
        </div>
      </div>
    </article>
  )
}
