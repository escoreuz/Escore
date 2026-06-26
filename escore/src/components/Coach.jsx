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

function initials(name) {
  const p = (name || '').trim().split(/\s+/)
  return (p.length > 1 ? p.slice(0, 2).map((x) => x[0]).join('') : (name || '').slice(0, 3)).toUpperCase()
}
function Badge({ name, c, id }) {
  return <Crest name={name} c={c} id={id} kind="team" size="sm" />
}

const TABS = [
  { key: 'sharh', label: 'Sharh' },
  { key: 'karyera', label: 'Karyera' },
  { key: 'oyin', label: 'O\'yinlar' },
]

function Overview({ c }) {
  const r = c.record
  const total = Math.max(1, r.games)
  const rows = [
    ['Joriy jamoa', c.team],
    ['Fuqarolik', `${c.flag} ${c.country}`],
    ['Yosh', `${c.age} yosh`],
    ['Sevimli sxema', c.formation],
    ['Boshqargan o\'yinlar', c.totalGames],
    ['Jami kuboklar', `🏆 ${c.totalTrophies}`],
  ]
  return (
    <div className="co-overview">
      <table className="tm-info">
        <tbody>
          {rows.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}
        </tbody>
      </table>

      <h4 className="mp-subtitle">Joriy mavsum ko'rsatkichi</h4>
      <div className="co-record">
        <div className="co-bar">
          <span className="co-bar__seg is-w" style={{ width: (r.w / total) * 100 + '%' }}>{r.w}</span>
          <span className="co-bar__seg is-d" style={{ width: (r.d / total) * 100 + '%' }}>{r.d}</span>
          <span className="co-bar__seg is-l" style={{ width: (r.l / total) * 100 + '%' }}>{r.l}</span>
        </div>
        <div className="co-bar__labels">
          <span>G'alaba {r.w}</span><span>Durang {r.d}</span><span>Mag'lubiyat {r.l}</span>
        </div>
      </div>

      <div className="co-kpis">
        <div className="co-kpi"><span className="co-kpi__num">{r.games}</span><span className="co-kpi__cap">O'yinlar</span></div>
        <div className="co-kpi"><span className="co-kpi__num">{r.ppg}</span><span className="co-kpi__cap">O'rtacha ochko</span></div>
        <div className="co-kpi"><span className="co-kpi__num">{r.winPct}%</span><span className="co-kpi__cap">G'alaba foizi</span></div>
      </div>
    </div>
  )
}

function Career({ c }) {
  return (
    <table className="co-career">
      <thead>
        <tr><th className="lg-table__club">Klub</th><th>Davr</th><th>O'yin</th><th>O'rt.ochko</th><th>Kubok</th></tr>
      </thead>
      <tbody>
        {c.career.map((row, i) => (
          <tr key={i} className={i === 0 ? 'co-cur' : ''}>
            <td className="lg-table__club">
              {row.id ? (
                <a
                  href={`#/team/${row.id}`}
                  onClick={(e) => { e.preventDefault(); navigate(`/team/${row.id}`) }}
                  className="lg-club__link"
                >
                  <Badge name={row.club} c={row.c} id={row.id} />
                  <span className="lg-club__name">{row.club}</span>
                </a>
              ) : (
                <span className="lg-club__link"><Badge name={row.club} c={row.c} /> <span className="lg-club__name">{row.club}</span></span>
              )}
            </td>
            <td>{row.from}–{row.to}</td>
            <td>{row.games}</td>
            <td className="lg-pts">{row.ppg}</td>
            <td>{row.trophies > 0 ? '🏆'.repeat(row.trophies) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Matches({ c }) {
  if (c.matches.length === 0) return <p className="mp-empty">O'yinlar topilmadi.</p>
  const dayLabel = (d) => DAYS.find((x) => x.date === d)?.label || d
  return (
    <div className="lg-matches">
      {c.matches.map((m) => {
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

export default function Coach({ id }) {
  const [tab, setTab] = useState('sharh')
  const { data: c, loading, error } = useApi(() => api.coach(id), [id])

  if (loading) return <Loading />
  if (error || !c) return <ErrorBox message={error} />

  return (
    <section className="co">
      <a href="#/score" onClick={(e) => { e.preventDefault(); navigate('/score') }} className="article__back">
        ← Score
      </a>

      <header className="pl-hero">
        <span className="pl-hero__av" style={{ background: c.teamColor }}>{initials(c.name)}</span>
        <div className="pl-hero__info">
          <p className="kicker">{c.flag} BOSH MURABBIY</p>
          <h1 className="pl-hero__name">{c.name}</h1>
          <p className="pl-hero__team">
            {c.teamId ? (
              <a
                href={`#/team/${c.teamId}`}
                onClick={(e) => { e.preventDefault(); navigate(`/team/${c.teamId}`) }}
                className="pl-hero__teamlink"
              >
                <Badge name={c.team} c={c.teamColor} id={c.teamId} /> {c.team}
              </a>
            ) : (
              <span><Badge name={c.team} c={c.teamColor} /> {c.team}</span>
            )}
          </p>
        </div>
        <div className="pl-hero__rating">
          <span className="pl-hero__num">{c.record.winPct}%</span>
          <span className="pl-hero__cap">G'alaba</span>
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
        {tab === 'sharh' && <Overview c={c} />}
        {tab === 'karyera' && <Career c={c} />}
        {tab === 'oyin' && <Matches c={c} />}
      </div>
    </section>
  )
}
