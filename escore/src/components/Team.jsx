import { useState } from 'react'
import { api, useApi } from '../api.js'
import { Loading, ErrorBox } from './States.jsx'
import { DAYS } from '../data/score.js'
import Crest from './Crest.jsx'
import { matchTime } from '../settings.js'

function navigate(hash) {
  window.location.hash = hash
  window.scrollTo(0, 0)
}

function Badge({ name, c, id, big }) {
  return <Crest name={name} c={c} id={id} kind="team" size={big ? 'lg' : 'sm'} />
}
function FormBadge({ r }) {
  const cls = r === 'G' ? 'is-w' : r === 'D' ? 'is-d' : 'is-l'
  return <span className={`lg-form ${cls}`}>{r}</span>
}

const TABS = [
  { key: 'sharh', label: 'Sharh' },
  { key: 'sostav', label: 'Sostav' },
  { key: 'oyinlar', label: 'O\'yinlar' },
  { key: 'jadval', label: 'Jadval' },
]

function Overview({ t }) {
  const rows = [
    ['Liga', `${t.league.flag} ${t.league.name}`],
    ['Mamlakat', t.country],
    ['Joriy o\'rin', t.standing ? `${t.standing}-o'rin` : '—'],
    ['Stadion', t.info.stadium],
    ['Shahar', t.info.city],
    ['Bosh murabbiy', t.info.coachId ? (
      <a
        href={`#/coach/${t.info.coachId}`}
        onClick={(e) => { e.preventDefault(); navigate(`/coach/${t.info.coachId}`) }}
        className="tm-coachlink"
      >
        {t.info.coach} ›
      </a>
    ) : t.info.coach],
    ['Tashkil etilgan', t.info.founded],
  ]
  return (
    <div className="tm-overview">
      <div className="tm-form">
        <span className="tm-form__label">Oxirgi 5 o'yin:</span>
        <span className="lg-forms">{t.form.map((f, i) => <FormBadge key={i} r={f} />)}</span>
      </div>
      <table className="tm-info">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}><th>{k}</th><td>{v}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="tm-about">
        <strong>{t.name}</strong> — {t.country} {t.league.name} vakili. Jamoa {t.info.founded}-yilda
        tashkil etilgan va o'z o'yinlarini <strong>{t.info.stadium}</strong> stadionida o'tkazadi.
        Hozirda jamoaga {t.info.coach} murabbiylik qiladi.
      </p>
    </div>
  )
}

function Squad({ t }) {
  return (
    <div className="tm-squad">
      {t.squad.map((group) => (
        <section key={group.label} className="tm-group">
          <h4 className="mp-subtitle">{group.label}</h4>
          <ul className="tm-players">
            {group.players.map((p) => (
              <li
                key={p.id || p.n + p.name}
                className={`tm-player${p.id ? ' tm-player--link' : ''}`}
                onClick={() => p.id && navigate(`/player/${p.id}`)}
                title={p.id ? "O'yinchi haqida ma'lumot" : ''}
              >
                <span className="tm-player__num">{p.n}</span>
                <span className="tm-player__flag">{p.flag}</span>
                <span className="tm-player__name">{p.name}</span>
                <span className="tm-player__pos">{p.pos}</span>
                <span className="tm-player__age">{p.age} yosh</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Matches({ t }) {
  if (t.matches.length === 0) return <p className="mp-empty">Bu jamoa uchun o'yinlar topilmadi.</p>
  const dayLabel = (d) => DAYS.find((x) => x.date === d)?.label || d
  return (
    <div className="lg-matches">
      {t.matches.map((m) => {
        const played = m.status === 'live' || m.status === 'ft'
        const status = m.status === 'live' ? `${m.minute}'` : m.status === 'ft' ? 'FT' : matchTime(m)
        return (
          <button key={m.id} className="lg-match" onClick={() => navigate(`/match/${m.id}`)}>
            <span className={`lg-match__status${m.status === 'live' ? ' is-live' : ''}`}>{status}</span>
            <span className="lg-match__team">
              <Badge name={m.home.n} c={m.home.c} id={m.home.id} /> {m.home.n}
            </span>
            <span className="lg-match__score">{played ? `${m.hs} : ${m.as}` : '—'}</span>
            <span className="lg-match__team lg-match__team--a">
              {m.away.n} <Badge name={m.away.n} c={m.away.c} id={m.away.id} />
            </span>
          </button>
        )
      })}
      <p className="tm-hint">{dayLabel(t.matches[0].date)} va boshqa turlar · o'yinni ochish uchun bosing</p>
    </div>
  )
}

function Table({ t }) {
  const { data, loading, error } = useApi(() => api.league(t.leagueId), [t.leagueId])
  if (loading) return <Loading />
  if (error || !data) return <ErrorBox message={error} />
  return (
    <table className="lg-table">
      <thead>
        <tr>
          <th>#</th><th className="lg-table__club">Klub</th>
          <th>O'</th><th>G'</th><th>D</th><th>M</th>
          <th className="lg-hide-sm">U-Z</th><th>F</th><th>O</th>
        </tr>
      </thead>
      <tbody>
        {data.rows.map((r) => (
          <tr key={r.name} className={r.name === t.name ? 'tm-row-hl' : ''}>
            <td className="lg-pos">{r.pos}</td>
            <td className="lg-table__club">
              <Badge name={r.name} c={r.c} id={r.id} />
              <span className="lg-club__name">{r.name}</span>
            </td>
            <td>{r.P}</td><td>{r.total.w}</td><td>{r.total.d}</td><td>{r.total.l}</td>
            <td className="lg-hide-sm">{r.GF}:{r.GA}</td>
            <td className={r.GD > 0 ? 'lg-gd-pos' : r.GD < 0 ? 'lg-gd-neg' : ''}>{r.GD > 0 ? '+' : ''}{r.GD}</td>
            <td className="lg-pts">{r.Pts}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function Team({ id }) {
  const [tab, setTab] = useState('sharh')
  const { data: t, loading, error } = useApi(() => api.team(id), [id])

  if (loading) return <Loading />
  if (error || !t) {
    return (
      <div className="article article--missing">
        <p className="kicker">404</p>
        <h2 className="lead__title">Jamoa topilmadi</h2>
        <a href="#/score" onClick={(e) => { e.preventDefault(); navigate('/score') }} className="readmore">← Score sahifasiga qaytish</a>
      </div>
    )
  }

  return (
    <section className="tm">
      <a href="#/score" onClick={(e) => { e.preventDefault(); navigate('/score') }} className="article__back">
        ← Score
      </a>

      <header className="tm-hero">
        <Badge name={t.name} c={t.color} id={t.id} big />
        <div>
          <p className="kicker">
            <a
              href={`#/league/${t.leagueId}`}
              onClick={(e) => { e.preventDefault(); navigate(`/league/${t.leagueId}`) }}
              className="tm-hero__league"
            >
              {t.league.flag} {t.league.name}
            </a>
          </p>
          <h1 className="tm-hero__name">{t.name}</h1>
          <p className="tm-hero__sub">{t.info.stadium} · {t.info.city}</p>
        </div>
      </header>

      <div className="mp-tabs">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            className={`mp-tab${tab === tb.key ? ' is-sel' : ''}`}
            onClick={() => setTab(tb.key)}
          >
            {tb.label}
          </button>
        ))}
      </div>

      <div className="tm-content">
        {tab === 'sharh' && <Overview t={t} />}
        {tab === 'sostav' && <Squad t={t} />}
        {tab === 'oyinlar' && <Matches t={t} />}
        {tab === 'jadval' && <Table t={t} />}
      </div>
    </section>
  )
}
