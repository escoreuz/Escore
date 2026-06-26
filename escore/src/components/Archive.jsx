import { useState, useEffect } from 'react'
import { api } from '../api.js'
import { Loading } from './States.jsx'

function navigate(hash) {
  window.location.hash = hash
  window.scrollTo(0, 0)
}

function Card({ a }) {
  const to = `/news/${a.slug}`
  const open = (e) => { e.preventDefault(); navigate(to) }
  return (
    <article className="nw-card">
      <a className="nw-card__media" href={`#${to}`} onClick={open}>
        {a.image
          ? <img className="nw-card__img" src={a.image} alt="" loading="lazy" />
          : <span className="nw-card__noimg">eSCORE</span>}
        {a.league && <span className="nw-card__league">{a.league}</span>}
      </a>
      <div className="nw-card__body">
        <a href={`#${to}`} onClick={open} className="nw-card__title">{a.title}</a>
        {a.subtitle && <p className="nw-card__sub">{a.subtitle}</p>}
        <div className="nw-card__meta">
          <span>{a.hasFull ? 'To‘liq maqola' : 'Qisqacha'}</span>
          <span>{a.time}</span>
        </div>
      </div>
    </article>
  )
}

export default function Archive() {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  // qidiruv/kategoriya o'zgarsa — 300ms debounce bilan yuklash
  useEffect(() => {
    let alive = true
    setLoading(true)
    const t = setTimeout(() => {
      api.archive({ q, category })
        .then((d) => { if (alive) { setData(d); setLoading(false) } })
        .catch(() => { if (alive) setLoading(false) })
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [q, category])

  const items = data?.items || []
  const categories = data?.categories || []

  return (
    <section className="nw arch">
      <header className="nw-head">
        <a href="#/news" onClick={(e) => { e.preventDefault(); navigate('/news') }} className="article__back">
          ← Yangiliklar
        </a>
        <p className="kicker">ARXIV · QIDIRUV</p>
        <h1 className="score__title">Maqolalar arxivi</h1>
        <p className="score__standfirst">
          Saytda ko'rilgan barcha maqolalar shu yerda saqlanadi — sarlavha yoki matn
          bo'yicha qidiring{data ? ` (${data.total} ta maqola)` : ''}.
        </p>
      </header>

      <div className="arch-tools">
        <input
          className="sc-search arch-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Maqola qidirish (sarlavha yoki matn)…"
          aria-label="Arxivdan qidirish"
        />
        <div className="arch-cats">
          <button
            className={`arch-cat${category === '' ? ' is-sel' : ''}`}
            onClick={() => setCategory('')}
          >
            Hammasi
          </button>
          {categories.map((c) => (
            <button
              key={c.name}
              className={`arch-cat${category === c.name ? ' is-sel' : ''}`}
              onClick={() => setCategory(c.name)}
            >
              {c.name} <span className="arch-cat__n">{c.count}</span>
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <Loading />
      ) : items.length === 0 ? (
        <p className="sc-empty">
          {q ? `“${q}” bo'yicha maqola topilmadi.` : 'Arxiv hozircha bo\'sh — yangiliklarni ochsangiz, ular shu yerga saqlanadi.'}
        </p>
      ) : (
        <div className="nw-grid">
          {items.map((a) => <Card key={a.slug} a={a} />)}
        </div>
      )}
    </section>
  )
}
