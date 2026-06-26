import { api, useApi } from '../api.js'
import { Loading } from './States.jsx'

function navigate(hash) {
  window.location.hash = hash
  window.scrollTo(0, 0)
}

export default function Article({ slug }) {
  const { data: article, loading } = useApi(() => api.article(slug), [slug])
  const { data: list } = useApi(() => api.news(), [])

  if (loading) return <Loading />

  if (!article) {
    return (
      <div className="article article--missing">
        <p className="kicker">404</p>
        <h2 className="lead__title">Maqola topilmadi</h2>
        <p>Bunday maqola mavjud emas yoki olib tashlangan.</p>
        <a href="#/" onClick={(e) => { e.preventDefault(); navigate('/') }} className="readmore">← Bosh sahifaga qaytish</a>
      </div>
    )
  }

  const related = (list || []).filter((a) => a.slug !== slug).slice(0, 3)

  return (
    <article className="article">
      <a
        href="#/"
        onClick={(e) => { e.preventDefault(); navigate('/') }}
        className="article__back"
      >
        ← Bosh sahifa
      </a>

      <header className="article__head">
        <p className="kicker">{article.kicker}</p>
        <h1 className="article__title">{article.title}</h1>
        <p className="article__standfirst">{article.standfirst}</p>
        <div className="article__meta">
          <span className="article__author">{article.author}</span>
          <span className="article__dot">•</span>
          <span>{article.date}</span>
          <span className="article__dot">•</span>
          <span>{article.readTime}</span>
        </div>
      </header>

      <figure className="article__figure">
        <div className="lead__photo">
          <div className="lead__photo-grid" />
          <span className="lead__photo-tag">{article.photoTag}</span>
        </div>
        <figcaption>{article.caption}</figcaption>
      </figure>

      <div className="article__body">
        {article.body.map((p, i) => (
          <p key={i} className={i === 0 ? 'dropcap' : ''}>{p}</p>
        ))}
      </div>

      <div className="article__share">
        <span className="article__share-label">ULASHISH:</span>
        {['Telegram', 'Facebook', 'X', 'Nusxa olish'].map((s) => (
          <a key={s} href="#" onClick={(e) => e.preventDefault()}>{s}</a>
        ))}
      </div>

      <hr className="hr" />

      <section className="article__related">
        <h4 className="box__title box__title--plain">SHUNINGDEK O'QING</h4>
        <div className="columns">
          {related.map((a) => (
            <article key={a.slug} className="columns__item">
              <p className="kicker kicker--sm">{a.kicker}</p>
              <h3>
                <a
                  href={`#/article/${a.slug}`}
                  onClick={(e) => { e.preventDefault(); navigate(`/article/${a.slug}`) }}
                  className="article__link"
                >
                  {a.title}
                </a>
              </h3>
              <p>{a.standfirst}</p>
              <a
                href={`#/article/${a.slug}`}
                onClick={(e) => { e.preventDefault(); navigate(`/article/${a.slug}`) }}
                className="readmore"
              >
                Davomini o'qish →
              </a>
            </article>
          ))}
        </div>
      </section>
    </article>
  )
}
