import { api, useApi } from '../api.js'
import { Loading, ErrorBox } from './States.jsx'

function navigate(hash) {
  window.location.hash = hash
  window.scrollTo(0, 0)
}

export default function NewsArticle({ slug }) {
  const { data: a, loading, error } = useApi(() => api.newsArticle(slug), [slug])

  if (loading) return <Loading label="Maqola yuklanmoqda…" />
  if (error || !a) return <ErrorBox message={error || 'Maqola topilmadi'} />

  return (
    <article className="na">
      <a href="#/news" onClick={(e) => { e.preventDefault(); navigate('/news') }} className="article__back">
        ← Yangiliklar
      </a>

      <header className="na-head">
        <p className="kicker">{a.league}</p>
        <h1 className="na-title">{a.title}</h1>
        {a.excerpt && <p className="na-standfirst">{a.excerpt}</p>}
        <div className="na-meta">
          <span>✍ {a.author}</span>
          <span>{a.time}</span>
        </div>
      </header>

      {a.image && (
        <figure className="na-figure">
          <img src={a.image} alt="" />
        </figure>
      )}

      <div className="na-body">
        {a.blocks.map((b, i) =>
          b.type === 'h'
            ? <h2 key={i} className="na-h2">{b.text}</h2>
            : <p key={i} className={i === 0 ? 'dropcap' : ''}>{b.text}</p>
        )}
      </div>

      <footer className="na-foot">
        <p>
          Manba:{' '}
          <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer">SofaScore</a>
          {' '}· o'zbek tiliga avtomatik tarjima qilingan.
        </p>
        <a href="#/news" onClick={(e) => { e.preventDefault(); navigate('/news') }} className="readmore">
          ← Barcha yangiliklar
        </a>
      </footer>
    </article>
  )
}
