function navigate(hash) {
  window.location.hash = hash
  window.scrollTo(0, 0)
}

// Bo'lim yoki qidiruv natijalari ro'yxati
export default function ListPage({ eyebrow, title, note, articles }) {
  return (
    <section className="listpage">
      <a
        href="#/"
        onClick={(e) => { e.preventDefault(); navigate('/') }}
        className="article__back"
      >
        ← Bosh sahifa
      </a>

      <header className="listpage__head">
        <p className="kicker">{eyebrow}</p>
        <h1 className="listpage__title">{title}</h1>
        {note && <p className="listpage__note">{note}</p>}
      </header>

      {articles.length === 0 ? (
        <p className="listpage__empty">Hech narsa topilmadi. Boshqa so'z bilan urinib ko'ring.</p>
      ) : (
        <div className="listpage__items">
          {articles.map((a) => (
            <article key={a.slug} className="listcard">
              <div className="listcard__thumb">
                <span className="listcard__thumb-tag">{a.section}</span>
              </div>
              <div className="listcard__body">
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
                <p className="listcard__text">{a.standfirst}</p>
                <div className="listcard__meta">
                  <span className="article__author">{a.author}</span>
                  <span className="article__dot">•</span>
                  <span>{a.date}</span>
                  <span className="article__dot">•</span>
                  <span>{a.readTime}</span>
                </div>
                <a
                  href={`#/article/${a.slug}`}
                  onClick={(e) => { e.preventDefault(); navigate(`/article/${a.slug}`) }}
                  className="readmore"
                >
                  Davomini o'qish →
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
