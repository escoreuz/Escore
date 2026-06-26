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

function Badge({ name, c, id }) {
  return <Crest name={name} c={c} id={id} kind="team" size="sm" />
}

const TABS = [
  { key: 'sharh', label: 'Sharh' },
  { key: 'oyin', label: 'O\'yinlar' },
]

function Overview({ r }) {
  const t = r.totals
  const rows = [
    ['Fuqarolik', `${r.flag} ${r.country}`],
    ['Yosh', `${r.age} yosh`],
    ['Jami o\'yinlar', t.apps],
    ['Jami sariq kartalar', t.yellow],
    ['Jami qizil kartalar', t.red],
    ['Jami penaltilar', t.pen],
  ]
  return (
    <div className="rf-overview">
      <div className="rf-kpis">
        <div className="rf-kpi"><span className="rf-kpi__num">{t.apps}</span><span className="rf-kpi__cap">O'yinlar</span></div>
        <div className="rf-kpi rf-kpi--y"><span className="rf-kpi__num">{t.yellow}</span><span className="rf-kpi__cap">Sariq</span></div>
        <div className="rf-kpi rf-kpi--r"><span className="rf-kpi__num">{t.red}</span><span className="rf-kpi__cap">Qizil</span></div>
        <div className="rf-kpi"><span className="rf-kpi__num">{t.pen}</span><span className="rf-kpi__cap">Penalti</span></div>
      </div>

      <table className="tm-info">
        <tbody>
          {rows.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}
        </tbody>
      </table>

      <h4 className="mp-subtitle">Karyera statistikasi (turnirlar bo'yicha)</h4>
      <table className="rf-career">
        <thead>
          <tr>
            <th className="rf-career__comp">Turnir</th>
            <th>O'yin</th>
            <th title="O'rtacha sariq">⌀ Sariq</th>
            <th>Qizil</th>
            <th>Penalti</th>
          </tr>
        </thead>
        <tbody>
          {r.career.map((c) => (
            <tr key={c.id}>
              <td className="rf-career__comp"><span className="rf-flag">{c.flag}</span> {c.name}</td>
              <td>{c.apps}</td>
              <td><span className="rf-yel">{c.avgYellow}</span></td>
              <td>{c.red}</td>
              <td>{c.pen}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Matches({ r }) {
  if (r.matches.length === 0) return <p className="mp-empty">Bu hakam tayinlangan o'yinlar topilmadi.</p>
  const dayLabel = (d) => DAYS.find((x) => x.date === d)?.label || d
  return (
    <div className="lg-matches">
      {r.matches.map((m) => {
        const played = m.status === 'live' || m.status === 'ft'
        const status = m.status === 'live' ? `${m.minute}'` : m.status === 'ft' ? 'FT' : matchTime(m)
        return (
          <button key={m.id} className="lg-match" onClick={() => navigate(`/match/${m.id}`)}>
            <span className={`lg-match__status${m.status === 'live' ? ' is-live' : ''}`}>{status}</span>
            <span className="lg-match__team"><Badge name={m.home.n} c={m.home.c} id={m.home.id} /> {m.home.n}</span>
            <span className="lg-match__score">{played ? `${m.hs} : ${m.as}` : '—'}</span>
            <span className="lg-match__team lg-match__team--a">{m.away.n} <Badge name={m.away.n} c={m.away.c} id={m.away.id} /></span>
          </button>
        )
      })}
    </div>
  )
}

export default function Referee({ id }) {
  const [tab, setTab] = useState('sharh')
  const { data: r, loading, error } = useApi(() => api.referee(id), [id])

  if (loading) return <Loading />
  if (error || !r) return <ErrorBox message={error} />

  return (
    <section className="rf">
      <a href="#/score" onClick={(e) => { e.preventDefault(); navigate('/score') }} className="article__back">
        ← Score
      </a>

      <header className="pl-hero">
        <span className="pl-hero__av rf-whistle">⚖</span>
        <div className="pl-hero__info">
          <p className="kicker">{r.flag} HAKAM</p>
          <h1 className="pl-hero__name">{r.name}</h1>
          <p className="pl-hero__team">{r.country} · {r.totals.apps} o'yin boshqargan</p>
        </div>
        <div className="pl-hero__rating">
          <span className="pl-hero__num">{r.totals.pen}</span>
          <span className="pl-hero__cap">Penalti</span>
        </div>
      </header>

      <div className="mp-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`mp-tab${tab === t.key ? ' is-sel' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pl-content">
        {tab === 'sharh' && <Overview r={r} />}
        {tab === 'oyin' && <Matches r={r} />}
      </div>
    </section>
  )
}
