import { useState, useEffect } from 'react'
import { ISSUE, TICKER } from './data/news.js'
import { api, useApi } from './api.js'
import { Loading } from './components/States.jsx'
import Article from './components/Article.jsx'
import ListPage from './components/ListPage.jsx'
import Score from './components/Score.jsx'
import Match from './components/Match.jsx'
import League from './components/League.jsx'
import Team from './components/Team.jsx'
import Player from './components/Player.jsx'
import Coach from './components/Coach.jsx'
import Referee from './components/Referee.jsx'
import News from './components/News.jsx'
import NewsArticle from './components/NewsArticle.jsx'
import Archive from './components/Archive.jsx'
import Rankings from './components/Rankings.jsx'
import { getSettings, setSettings, TIMEZONES, matchTime } from './settings.js'
import logoUrl from './assets/logo.svg'

const NAV = [
  { label: 'Bosh sahifa', to: '/' },
  { label: 'Score', to: '/score' },
  { label: 'Yangiliklar', to: '/news' },
  { label: 'Arxiv', to: '/archive' },
  { label: 'Chempionlar Ligasi', to: '/section/CHEMPIONLAR LIGASI' },
  { label: 'Transfer', to: '/section/TRANSFER' },
  { label: 'Milliy terma', to: '/section/MILLIY TERMA' },
  { label: 'Tahlil', to: '/section/TAHLIL' },
  { label: 'Taktika', to: '/section/TAKTIKA' },
  { label: 'Intervyu', to: '/section/INTERVYU' },
]

function navigate(hash) {
  window.location.hash = hash
  window.scrollTo(0, 0)
}

function useRoute() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const path = hash.replace(/^#/, '') || '/'
  if (path === '/score') return { name: 'score' }
  if (path === '/news') return { name: 'news' }
  if (path === '/archive') return { name: 'archive' }
  const rankR = path.match(/^\/rankings\/(.+)$/)
  if (rankR) return { name: 'rankings', kind: decodeURIComponent(rankR[1]) }
  const newsArt = path.match(/^\/news\/(.+)$/)
  if (newsArt) return { name: 'newsArticle', slug: decodeURIComponent(newsArt[1]) }
  const matchR = path.match(/^\/match\/(.+)$/)
  if (matchR) return { name: 'match', id: decodeURIComponent(matchR[1]) }
  const leagueR = path.match(/^\/league\/(.+)$/)
  if (leagueR) return { name: 'league', id: decodeURIComponent(leagueR[1]) }
  const teamR = path.match(/^\/team\/(.+)$/)
  if (teamR) return { name: 'team', id: decodeURIComponent(teamR[1]) }
  const playerR = path.match(/^\/player\/(.+)$/)
  if (playerR) return { name: 'player', id: decodeURIComponent(playerR[1]) }
  const coachR = path.match(/^\/coach\/(.+)$/)
  if (coachR) return { name: 'coach', id: decodeURIComponent(coachR[1]) }
  const refR = path.match(/^\/referee\/(.+)$/)
  if (refR) return { name: 'referee', id: decodeURIComponent(refR[1]) }
  const article = path.match(/^\/article\/(.+)$/)
  if (article) return { name: 'article', slug: decodeURIComponent(article[1]) }
  const section = path.match(/^\/section\/(.+)$/)
  if (section) return { name: 'section', section: decodeURIComponent(section[1]) }
  const search = path.match(/^\/search\/(.+)$/)
  if (search) return { name: 'search', query: decodeURIComponent(search[1]) }
  return { name: 'home' }
}

function SearchBox() {
  const [q, setQ] = useState('')
  const submit = (e) => {
    e.preventDefault()
    const term = q.trim()
    if (term) navigate(`/search/${encodeURIComponent(term)}`)
  }
  return (
    <form className="search" onSubmit={submit} role="search">
      <input
        className="search__input"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Qidirish…"
        aria-label="Saytdan qidirish"
      />
      <button className="search__btn" type="submit" aria-label="Qidirish">⌕</button>
    </form>
  )
}

function SettingsMenu() {
  const [open, setOpen] = useState(false)
  const [s, setS] = useState(getSettings())

  useEffect(() => {
    const onChange = () => setS({ ...getSettings() })
    window.addEventListener('esocre-settings', onChange)
    return () => window.removeEventListener('esocre-settings', onChange)
  }, [])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (!e.target.closest('.settings')) setOpen(false) }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [open])

  return (
    <div className="settings">
      <button
        className="settings__btn"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        aria-label="Sozlamalar"
        title="Sozlamalar"
        aria-expanded={open}
      >
        ⚙
      </button>
      {open && (
        <div className="settings__panel" role="menu">
          <div className="settings__group">
            <span className="settings__label">Ko'rinish</span>
            <div className="settings__themes">
              <button
                className={`settings__theme${s.theme === 'light' ? ' is-sel' : ''}`}
                onClick={() => setSettings({ theme: 'light' })}
              >
                ☀ Yorug'
              </button>
              <button
                className={`settings__theme${s.theme === 'dark' ? ' is-sel' : ''}`}
                onClick={() => setSettings({ theme: 'dark' })}
              >
                ☾ Tungi
              </button>
            </div>
          </div>
          <div className="settings__group">
            <span className="settings__label">Vaqt mintaqasi (soat)</span>
            <select
              className="settings__select"
              value={s.tz}
              onChange={(e) => setSettings({ tz: e.target.value })}
            >
              {TIMEZONES.map((z) => (
                <option key={z.id} value={z.id}>{z.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}

function Masthead({ activeTo }) {
  return (
    <header className="masthead">
      <div className="masthead__top">
        <span>{ISSUE.volume} · {ISSUE.no}</span>
        <span>{ISSUE.weather}</span>
        <span>{ISSUE.price}</span>
      </div>

      <div className="masthead__title">
        <h1 className="logo">
          <a href="#/" onClick={(e) => { e.preventDefault(); navigate('/') }} className="logo__link">
            e<span className="logo__score">SCORE</span>
          </a>
        </h1>
      </div>

      <p className="masthead__motto">FUTBOL GAZETASI · «Maydondagi har bir lahza — tarix»</p>

      <div className="masthead__dateline">
        <span>{ISSUE.city}</span>
        <span>{ISSUE.weekday}, {ISSUE.date}</span>
        <span>escore.uz</span>
      </div>

      <nav className="masthead__nav">
        <div className="masthead__links">
          {NAV.map((n) => (
            <a
              key={n.to}
              href={`#${n.to}`}
              onClick={(e) => { e.preventDefault(); navigate(n.to) }}
              className={activeTo === n.to ? 'is-active' : ''}
            >
              {n.label}
            </a>
          ))}
        </div>
        <div className="masthead__tools">
          <SearchBox />
          <SettingsMenu />
        </div>
      </nav>
    </header>
  )
}

function Ticker({ items }) {
  const list = items && items.length ? items : TICKER
  return (
    <div className="ticker">
      <span className="ticker__label">SO'NGGI DAQIQA</span>
      <div className="ticker__viewport">
        <div className="ticker__track">
          {[...list, ...list].map((t, i) => (
            <span key={i} className="ticker__item">⚽ {t}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

function ArticleLink({ slug, className, children }) {
  return (
    <a
      href={`#/article/${slug}`}
      onClick={(e) => { e.preventDefault(); navigate(`/article/${slug}`) }}
      className={className}
    >
      {children}
    </a>
  )
}

// Maqola havolasi — har doim o'z saytimizda ochiladi.
// Real yangilik: href=/news/<slug>; demo maqola: /article/<slug>.
function StoryLink({ a, className, children }) {
  const to = a?.href || (a?.slug ? `/article/${a.slug}` : '/')
  return (
    <a
      href={`#${to}`}
      onClick={(e) => { e.preventDefault(); navigate(to) }}
      className={className}
    >
      {children}
    </a>
  )
}

function Lead({ a }) {
  return (
    <article className="lead">
      <p className="kicker">{a.kicker}</p>
      <h2 className="lead__title">
        <StoryLink a={a} className="article__link">{a.title}</StoryLink>
      </h2>
      <p className="lead__standfirst">{a.standfirst}</p>

      <figure className="lead__figure">
        <StoryLink a={a} className="lead__photo">
          {a.image
            ? <img className="lead__img" src={a.image} alt="" loading="lazy" />
            : <div className="lead__photo-grid" />}
          {a.photoTag && <span className="lead__photo-tag">{a.photoTag}</span>}
        </StoryLink>
        {a.caption && <figcaption>{a.caption}</figcaption>}
      </figure>

      <div className="lead__body">
        {(a.body || []).slice(0, 2).map((p, i) => (
          <p key={i} className={i === 0 ? 'dropcap' : ''}>{p}</p>
        ))}
        <p className="lead__continue">
          <StoryLink a={a} className="readmore">Davomini o'qish →</StoryLink>
        </p>
      </div>
    </article>
  )
}

function SecondaryStories({ items }) {
  return (
    <div className="secondary">
      {items.map((s, i) => (
        <article key={s.slug || i} className="secondary__item">
          {s.image && (
            <StoryLink a={s} className="secondary__media">
              <img src={s.image} alt="" loading="lazy" />
            </StoryLink>
          )}
          <p className="kicker kicker--sm">{s.kicker}</p>
          <h3>
            <StoryLink a={s} className="article__link">{s.title}</StoryLink>
          </h3>
          <p>{s.standfirst}</p>
          <StoryLink a={s} className="readmore">Davomini o'qish →</StoryLink>
        </article>
      ))}
    </div>
  )
}

function Standings({ rows }) {
  return (
    <section className="box">
      <h4 className="box__title">TURNIR JADVALI</h4>
      <table className="standings">
        <thead>
          <tr><th>#</th><th>Klub</th><th>O'</th><th>G'</th><th>D</th><th>M</th><th>O</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.pos} className={r.pos <= 4 ? 'is-top' : ''}>
              <td className="standings__pos">{r.pos}</td>
              <td className="standings__club">{r.club}</td>
              <td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td>
              <td className="standings__pts">{r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="box__foot">Yashil — Chempionlar Ligasi zonasi</p>
    </section>
  )
}

function Results({ items }) {
  return (
    <section className="box">
      <h4 className="box__title">SO'NGGI NATIJALAR</h4>
      <ul className="results">
        {items.map((m, i) => (
          <li key={i} className="results__row">
            <span className="results__team results__team--h">{m.home}</span>
            <span className="results__score">{m.hs}<i>:</i>{m.as}</span>
            <span className="results__team results__team--a">{m.away}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Fixtures({ items }) {
  return (
    <section className="box">
      <h4 className="box__title">BUGUNGI O'YINLAR</h4>
      <ul className="fixtures">
        {items.map((m, i) => (
          <li key={i} className="fixtures__row">
            <span className="fixtures__time">{matchTime(m)}</span>
            <span className="fixtures__match">{m.home} — {m.away}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Columns({ items }) {
  return (
    <div className="columns">
      {items.map((c, i) => (
        <article key={c.slug || i} className="columns__item">
          <p className="kicker kicker--sm">{c.kicker}</p>
          <h3>
            <StoryLink a={c} className="article__link">{c.title}</StoryLink>
          </h3>
          <p>{c.standfirst}</p>
          <p className="columns__author">— {c.author}</p>
        </article>
      ))}
    </div>
  )
}

function Quote({ quote }) {
  return (
    <blockquote className="pullquote">
      <span className="pullquote__mark">“</span>
      <p>{quote.text}</p>
      <cite>— {quote.author}</cite>
    </blockquote>
  )
}

function Briefs({ items }) {
  return (
    <section className="box box--briefs">
      <h4 className="box__title">QISQA XABARLAR</h4>
      <ul className="briefs">
        {items.map((b, i) => (
          <li key={i}><span className="briefs__bullet">▪</span>{b}</li>
        ))}
      </ul>
    </section>
  )
}

function Footer() {
  return (
    <footer className="foot">
      <div className="foot__rule" />
      <div className="foot__grid">
        <div>
          <h5 className="logo logo--sm foot__brand">
            <img src={logoUrl} alt="" className="foot__logo" />
            e<span className="logo__score">SCORE</span>
          </h5>
          <p>Futbol gazetasi. Maydondagi har bir lahza — tarix.</p>
        </div>
        <div>
          <h6>Bo'limlar</h6>
          <p>Chempionlar Ligasi · Premier-liga · Transferlar · Milliy terma · Tahlil</p>
        </div>
        <div>
          <h6>Tahririyat</h6>
          <p>Toshkent sh. · tahririyat@escore.uz · +998 (71) 200-00-00</p>
        </div>
      </div>
      <p className="foot__copy">© 2026 eSCORE. Barcha huquqlar himoyalangan. {ISSUE.no} · {ISSUE.date}</p>
    </footer>
  )
}

function Home() {
  const { data: h, loading, error } = useApi(() => api.home(), [])
  if (loading) return <Loading label="Bosh sahifa yuklanmoqda…" />
  if (error || !h) return <Loading label="Server bilan aloqa yo'q (port 4500)" />
  return (
    <>
      <Ticker items={h.ticker} />
      <main className="grid">
        <div className="grid__main">
          <Lead a={h.lead} />
          <hr className="hr" />
          <SecondaryStories items={h.secondary} />
          <hr className="hr" />
          <Quote quote={h.quote} />
          <hr className="hr" />
          <Columns items={h.columns} />
        </div>

        <aside className="grid__side">
          <Standings rows={h.standings} />
          <Results items={h.results} />
          <Fixtures items={h.fixtures} />
          <Briefs items={h.briefs} />
        </aside>
      </main>
    </>
  )
}

function SectionPage({ section }) {
  const { data: list, loading } = useApi(() => api.news(), [])
  if (loading) return <Loading />
  const items = (list || []).filter((a) => a.section === section)
  return (
    <ListPage
      eyebrow="BO'LIM"
      title={section}
      note={`Ushbu bo'limda ${items.length} ta maqola`}
      articles={items}
    />
  )
}

function SearchPage({ query }) {
  const { data, loading } = useApi(() => api.search(query), [query])
  if (loading) return <Loading />
  const items = data?.articles || []
  return (
    <ListPage
      eyebrow="QIDIRUV NATIJALARI"
      title={`«${query}»`}
      note={`${items.length} ta natija topildi`}
      articles={items}
    />
  )
}

function renderRoute(route) {
  if (route.name === 'score') return <Score />
  if (route.name === 'news') return <News />
  if (route.name === 'archive') return <Archive />
  if (route.name === 'rankings') return <Rankings kind={route.kind} />
  if (route.name === 'newsArticle') return <NewsArticle slug={route.slug} />
  if (route.name === 'match') return <Match id={route.id} />
  if (route.name === 'league') return <League id={route.id} />
  if (route.name === 'team') return <Team id={route.id} />
  if (route.name === 'player') return <Player id={route.id} />
  if (route.name === 'coach') return <Coach id={route.id} />
  if (route.name === 'referee') return <Referee id={route.id} />
  if (route.name === 'article') return <Article slug={route.slug} />
  if (route.name === 'section') return <SectionPage section={route.section} />
  if (route.name === 'search') return <SearchPage query={route.query} />
  return <Home />
}

export default function App() {
  const route = useRoute()
  // Sozlama (mavzu/mintaqa) o'zgarsa butun sahifani qayta render qilamiz —
  // o'yin vaqtlari yangi mintaqa bo'yicha qayta formatlanishi uchun.
  const [, setTick] = useState(0)
  useEffect(() => {
    const on = () => setTick((t) => t + 1)
    window.addEventListener('esocre-settings', on)
    return () => window.removeEventListener('esocre-settings', on)
  }, [])
  const activeTo =
    route.name === 'section' ? `/section/${route.section}`
      : route.name === 'archive' ? '/archive'
        : ['news', 'newsArticle'].includes(route.name) ? '/news'
        : ['score', 'match', 'league', 'team', 'player', 'coach', 'referee'].includes(route.name) ? '/score'
          : route.name === 'home' ? '/'
            : null
  return (
    <div className="paper">
      <div className="paper__sheet">
        <Masthead activeTo={activeTo} />
        {renderRoute(route)}
        <Footer />
      </div>
    </div>
  )
}
