// Yangiliklar lentasi (SofaScore'dan tarjima qilingan) — kartochkalar o'z saytimizdagi sahifaga ochiladi
import { api, useApi } from '../api.js'
import { Link } from '../lib/nav.jsx'
import { useSeo } from '../lib/seo.js'
import { AsyncView } from './States.jsx'
import NewsCard from './news/NewsCard.jsx'

const feedItems = data => (Array.isArray(data?.items) ? data.items.filter(n => n?.slug) : [])
const cardMeta = n => [n.source || n.match, n.time]

function NewsGrid({ items }) {
  const [lead, ...rest] = items
  return (
    <>
      <NewsCard item={lead} meta={cardMeta(lead)} big />
      <div className="nw-grid">
        {rest.map(n => (
          <NewsCard key={n.id ?? n.slug} item={n} meta={cardMeta(n)} />
        ))}
      </div>
    </>
  )
}

export default function News() {
  const state = useApi(o => api.feed(o), [])
  useSeo({
    title: 'Futbol yangiliklari',
    description: "Eng so'nggi futbol yangiliklari, o'yin sharhlari va matbuot anjumanlari — o'zbek tilida.",
    path: '/news',
  })

  return (
    <section className="nw">
      <header className="nw-head">
        <Link to="/score" className="article__back">
          ← Score
        </Link>
        <p className="kicker">YANGILIKLAR · SHARHLAR · LAVHALAR</p>
        <h1 className="score__title">Futbol yangiliklari</h1>
        <p className="score__standfirst">
          Eng so'nggi o'yin sharhlari, gollar va matbuot anjumanlari — to'g'ridan-to'g'ri jahon maydonlaridan, o'zbek
          tilida.
        </p>
      </header>

      <AsyncView
        state={state}
        loadingText="Yangiliklar yuklanmoqda…"
        isEmpty={d => feedItems(d).length === 0}
        empty="Hozircha yangilik topilmadi."
      >
        {d => <NewsGrid items={feedItems(d)} />}
      </AsyncView>
    </section>
  )
}
