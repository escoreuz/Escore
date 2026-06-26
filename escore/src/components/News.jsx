import { api, useApi } from '../api.js'
import { Loading, ErrorBox } from './States.jsx'

function navigate(hash) {
  window.location.hash = hash
  window.scrollTo(0, 0)
}

// Bitta yangilik kartasi (rasm + sarlavha) — o'z saytimizdagi batafsil sahifaga ochiladi
function NewsCard({ n, big }) {
  const to = `/news/${n.slug}`
  const open = (e) => { e.preventDefault(); navigate(to) }
  return (
    <article className={`nw-card${big ? ' nw-card--lead' : ''}`}>
      <a className="nw-card__media" href={`#${to}`} onClick={open}>
        <img className="nw-card__img" src={n.image} alt="" loading="lazy" />
        {n.isVideo && <span className="nw-card__play">▶</span>}
        {n.league && <span className="nw-card__league">{n.league}</span>}
      </a>
      <div className="nw-card__body">
        <a href={`#${to}`} onClick={open} className="nw-card__title">
          {n.title}
        </a>
        {n.subtitle && <p className="nw-card__sub">{n.subtitle}</p>}
        <div className="nw-card__meta">
          <span>{n.source || n.match}</span>
          <span>{n.time}</span>
        </div>
      </div>
    </article>
  )
}

export default function News() {
  const { data, loading, error } = useApi(() => api.feed(), [])

  if (loading) return <Loading />
  if (error) return <ErrorBox message={error} />

  const items = data?.items || []
  if (items.length === 0) {
    return (
      <section className="nw">
        <header className="nw-head">
          <p className="kicker">YANGILIKLAR · SHARHLAR</p>
          <h1 className="score__title">Futbol yangiliklari</h1>
        </header>
        <p className="sc-empty">Hozircha yangilik topilmadi.</p>
      </section>
    )
  }

  const [lead, ...rest] = items

  return (
    <section className="nw">
      <header className="nw-head">
        <a href="#/score" onClick={(e) => { e.preventDefault(); navigate('/score') }} className="article__back">
          ← Score
        </a>
        <p className="kicker">YANGILIKLAR · SHARHLAR · LAVHALAR</p>
        <h1 className="score__title">Futbol yangiliklari</h1>
        <p className="score__standfirst">
          Eng so'nggi o'yin sharhlari, gollar va matbuot anjumanlari — to'g'ridan-to'g'ri
          jahon maydonlaridan, o'zbek tilida.
        </p>
      </header>

      <NewsCard n={lead} big />

      <div className="nw-grid">
        {rest.map((n) => <NewsCard key={n.id} n={n} />)}
      </div>
    </section>
  )
}
