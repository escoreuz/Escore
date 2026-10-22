// "Yangiliklar" tabi: tahririyat lentasidan o'yinchi ismi / jamoasi / mamlakati bo'yicha saralangan xabarlar.
import { api, useApi } from '../../api.js'
import { Link } from '../../lib/nav.jsx'
import { ErrorBox, Loading } from '../States.jsx'

const MIN_TOKEN_LENGTH = 4

/** Qidiruv kalitlari: ismning uzun qismlari + jamoa + mamlakat (kichik harfda). */
export function newsTokens(p) {
  const nameParts = String(p?.name ?? '')
    .split(/\s+/)
    .filter(t => t.length >= MIN_TOKEN_LENGTH)
  const team = p?.team && p.team !== '—' ? p.team : null
  return [...nameParts, team, p?.base?.country]
    .filter(t => typeof t === 'string' && t && t !== '—')
    .map(t => t.toLowerCase())
}

const mentions = (n, tokens) => {
  const hay = `${n.title ?? ''} ${n.subtitle ?? ''}`.toLowerCase()
  return tokens.some(t => hay.includes(t))
}

function NewsCard({ n }) {
  const to = `/news/${encodeURIComponent(n.slug)}`
  return (
    <article className="nw-card">
      {/* Rasm-havola sarlavha havolasini takrorlaydi — klaviatura/ekran o'quvchidan yashirin */}
      <Link className="nw-card__media" to={to} tabIndex={-1} aria-hidden="true">
        {n.image && <img className="nw-card__img" src={n.image} alt={n.title} loading="lazy" decoding="async" />}
        {n.league && <span className="nw-card__league">{n.league}</span>}
      </Link>
      <div className="nw-card__body">
        <Link to={to} className="nw-card__title">
          {n.title}
        </Link>
        <div className="nw-card__meta">
          <span>{n.source}</span>
          <span>{n.time}</span>
        </div>
      </div>
    </article>
  )
}

export default function NewsTab({ player }) {
  const { data, loading, error, reload } = useApi(o => api.feed(o), [])
  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} title="Yangiliklarni yuklab bo'lmadi" />
  const tokens = newsTokens(player)
  const items = Array.isArray(data?.items) ? data.items : []
  const list = tokens.length ? items.filter(n => n?.slug && n.title && mentions(n, tokens)) : []
  if (!list.length) return <p className="mp-empty">Bu o'yinchi haqida hozircha yangilik yo'q.</p>
  return (
    <div className="nw-grid">
      {list.map(n => (
        <NewsCard key={n.id ?? n.slug} n={n} />
      ))}
    </div>
  )
}
