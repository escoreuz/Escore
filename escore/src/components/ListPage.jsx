// Bo'lim yoki qidiruv natijalari ro'yxati (ko'rinish). Ma'lumot, xato holati va useSeo chaqiruvchida
// (home/ListRoutes.jsx) — sahifada useSeo bir marta bo'lishi uchun bu yerda chaqirilmaydi.
import { Link } from '../lib/nav.jsx'
import NewsImage from './news/NewsImage.jsx'
import { articlePath } from './news/paths.js'

const THUMB_WIDTH = 320
const THUMB_HEIGHT = 180

function ListCard({ a }) {
  const to = articlePath(a.slug)
  const title = a.title || 'Sarlavhasiz maqola'
  return (
    <article className="listcard">
      <div className="listcard__thumb">
        <NewsImage
          src={a.image}
          alt={title}
          className="listcard__img"
          fallbackClassName={null}
          width={THUMB_WIDTH}
          height={THUMB_HEIGHT}
        />
        {a.section && <span className="listcard__thumb-tag">{a.section}</span>}
      </div>
      <div className="listcard__body">
        {a.kicker && <p className="kicker kicker--sm">{a.kicker}</p>}
        <h2 className="listcard__title">
          <Link to={to} className="article__link">
            {title}
          </Link>
        </h2>
        {a.standfirst && <p className="listcard__text">{a.standfirst}</p>}
        <div className="listcard__meta">
          <span className="article__author">{a.author ?? '—'}</span>
          <span className="article__dot">•</span>
          <span>{a.date ?? '—'}</span>
          <span className="article__dot">•</span>
          <span>{a.readTime ?? '—'}</span>
        </div>
        {/* Sarlavha-havolani takrorlaydi — klaviatura va ekran o'quvchidan yashiriladi */}
        <Link to={to} className="readmore" tabIndex={-1} aria-hidden="true">
          Davomini o'qish →
        </Link>
      </div>
    </article>
  )
}

/**
 * @param {{ eyebrow: string, title: string, note?: string, articles?: object[] }} props
 */
export default function ListPage({ eyebrow, title, note, articles }) {
  const list = Array.isArray(articles) ? articles.filter(a => a?.slug) : []
  return (
    <section className="listpage">
      <Link to="/" className="article__back">
        ← Bosh sahifa
      </Link>

      <header className="listpage__head">
        <p className="kicker">{eyebrow}</p>
        <h1 className="listpage__title">{title}</h1>
        {note && <p className="listpage__note">{note}</p>}
      </header>

      {list.length === 0 ? (
        <p className="listpage__empty">Hech narsa topilmadi. Boshqa so'z bilan urinib ko'ring.</p>
      ) : (
        <div className="listpage__items">
          {list.map(a => (
            <ListCard key={a.slug} a={a} />
          ))}
        </div>
      )}
    </section>
  )
}
