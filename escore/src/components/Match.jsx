import { useState } from 'react'
import { api, useApi } from '../api.js'
import { Loading, ErrorBox } from './States.jsx'
import { STANDINGS } from '../data/news.js'
import Crest from './Crest.jsx'
import { matchTime } from '../settings.js'

function navigate(hash) {
  window.location.hash = hash
  window.scrollTo(0, 0)
}

function Badge({ team, big }) {
  return <Crest name={team.n} c={team.c} id={team.id} kind="team" size={big ? 'lg' : undefined} />
}

const TABS = [
  { key: 'sharh', label: 'Sharh' },
  { key: 'stat', label: 'Statistika' },
  { key: 'tarkib', label: 'Tarkiblar' },
  { key: 'jadval', label: 'Jadval' },
]

function dots(lineup, side) {
  const cols = [1, ...lineup.lines]
  const n = cols.length
  const players = [...lineup.players]
  const res = []
  let idx = 0
  cols.forEach((cnt, ci) => {
    const frac = n === 1 ? 0 : ci / (n - 1)
    const x = side === 'home' ? 7 + frac * 40 : 93 - frac * 40
    for (let j = 0; j < cnt; j++) {
      const y = ((j + 1) / (cnt + 1)) * 100
      if (players[idx]) res.push({ ...players[idx++], x, y })
    }
  })
  return res
}

function Pitch({ d }) {
  const home = dots(d.lineups.home, 'home')
  const away = dots(d.lineups.away, 'away')
  return (
    <div className="mp-pitch">
      <div className="mp-pitch__line" />
      <div className="mp-pitch__circle" />
      {home.map((p, i) => (
        <span key={'h' + i} className="mp-dot mp-dot--home" style={{ left: p.x + '%', top: p.y + '%', background: d.match.home.c }}>
          {p.n}
        </span>
      ))}
      {away.map((p, i) => (
        <span key={'a' + i} className="mp-dot mp-dot--away" style={{ left: p.x + '%', top: p.y + '%', background: d.match.away.c }}>
          {p.n}
        </span>
      ))}
    </div>
  )
}

const EVENT_ICON = { goal: '⚽', yellow: '🟨', red: '🟥' }

function Overview({ d }) {
  if (!d.played) {
    return (
      <div className="mp-pre">
        <p className="mp-pre__msg">O'yin hali boshlanmagan. Boshlanish vaqti: <strong>{d.match.time}</strong></p>
        <VoteBar d={d} />
      </div>
    )
  }
  return (
    <div>
      <VoteBar d={d} />

      <h4 className="mp-subtitle">O'yin voqealari</h4>
      <ul className="mp-events">
        {d.events.map((e, i) => (
          <li key={i} className={`mp-event mp-event--${e.team}`}>
            <div className="mp-event__home">
              {e.team === 'home' && (
                <span className="mp-event__txt">
                  <strong>{e.player}</strong>{e.assist ? ` (${e.assist})` : ''} <span className="mp-event__ic">{EVENT_ICON[e.type]}</span>
                </span>
              )}
            </div>
            <span className="mp-event__min">{e.min}'</span>
            <div className="mp-event__away">
              {e.team === 'away' && (
                <span className="mp-event__txt">
                  <span className="mp-event__ic">{EVENT_ICON[e.type]}</span> <strong>{e.player}</strong>{e.assist ? ` (${e.assist})` : ''}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      <h4 className="mp-subtitle">Hujum momentumi</h4>
      <div className="mp-momentum">
        {d.momentum.map((v, i) => (
          <span
            key={i}
            className={`mp-mbar ${v >= 0 ? 'is-home' : 'is-away'}`}
            style={{
              height: Math.abs(v) + '%',
              background: v >= 0 ? d.match.home.c : d.match.away.c,
            }}
          />
        ))}
      </div>
    </div>
  )
}

function VoteBar({ d }) {
  return (
    <div className="mp-vote">
      <h4 className="mp-subtitle">Kim yutadi?</h4>
      <div className="mp-vote__bar">
        <span className="mp-vote__seg is-home" style={{ width: d.vote.home + '%', background: d.match.home.c }}>{d.vote.home}%</span>
        <span className="mp-vote__seg is-draw" style={{ width: d.vote.draw + '%' }}>{d.vote.draw}%</span>
        <span className="mp-vote__seg is-away" style={{ width: d.vote.away + '%', background: d.match.away.c }}>{d.vote.away}%</span>
      </div>
      <div className="mp-vote__labels">
        <span>{d.match.home.n}</span>
        <span>Durang</span>
        <span>{d.match.away.n}</span>
      </div>
    </div>
  )
}

function Stats({ d }) {
  if (!d.played) return <p className="mp-empty">Statistika o'yin boshlangach paydo bo'ladi.</p>
  return (
    <div className="mp-stats">
      {d.stats.map((s, i) => {
        const h = parseFloat(s.home)
        const a = parseFloat(s.away)
        const tot = h + a || 1
        return (
          <div key={i} className="mp-stat">
            <div className="mp-stat__row">
              <span className="mp-stat__val">{s.home}{s.label.includes('%') ? '%' : ''}</span>
              <span className="mp-stat__label">{s.label.replace(', %', '')}</span>
              <span className="mp-stat__val">{s.away}{s.label.includes('%') ? '%' : ''}</span>
            </div>
            <div className="mp-stat__bar">
              <span className="mp-stat__fill is-home" style={{ width: (h / tot) * 100 + '%', background: d.match.home.c }} />
              <span className="mp-stat__fill is-away" style={{ width: (a / tot) * 100 + '%', background: d.match.away.c }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TeamSheet({ team, lineup }) {
  return (
    <div className="mp-sheet">
      <header className="mp-sheet__head">
        <Badge team={team} />
        <span className="mp-sheet__name">{team.n}</span>
        <span className="mp-sheet__form">{lineup.formation}</span>
      </header>
      <ul className="mp-sheet__list">
        {lineup.players.map((p) => (
          <li
            key={p.n + p.name}
            className={`mp-sheet__row${p.id ? '' : ' is-static'}`}
            onClick={() => p.id && navigate(`/player/${p.id}`)}
            title={p.id ? "O'yinchi haqida ma'lumot" : ''}
          >
            <span className="mp-sheet__num">{p.n}</span>
            <span className="mp-sheet__pname">{p.name}</span>
            <span className="mp-sheet__pos">{p.pos}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Lineups({ d }) {
  return (
    <div>
      <Pitch d={d} />
      <div className="mp-sheets">
        <TeamSheet team={d.match.home} lineup={d.lineups.home} />
        <TeamSheet team={d.match.away} lineup={d.lineups.away} />
      </div>
    </div>
  )
}

function Standings({ d }) {
  const names = [d.match.home.n, d.match.away.n]
  return (
    <table className="standings mp-standings">
      <thead>
        <tr><th>#</th><th>Klub</th><th>O'</th><th>G'</th><th>D</th><th>M</th><th>O</th></tr>
      </thead>
      <tbody>
        {STANDINGS.map((r) => (
          <tr key={r.pos} className={names.some((n) => r.club.includes(n) || n.includes(r.club)) ? 'is-hl' : ''}>
            <td className="standings__pos">{r.pos}</td>
            <td className="standings__club">{r.club}</td>
            <td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td>
            <td className="standings__pts">{r.pts}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function Match({ id }) {
  const [tab, setTab] = useState('sharh')
  const { data: d, loading, error } = useApi(() => api.match(id), [id])

  if (loading) return <Loading />
  if (error || !d) return <ErrorBox message={error} />

  const { match: m } = d
  const live = m.status === 'live'
  const status = live ? `${m.minute}'` : m.status === 'ft' ? 'TUGADI' : matchTime(m)

  return (
    <section className="mp">
      <a href="#/score" onClick={(e) => { e.preventDefault(); navigate('/score') }} className="article__back">
        ← Score
      </a>

      {/* Hero */}
      <header className="mp-hero">
        <p className="kicker">{d.league.country} · {d.league.name}{live ? ' · JONLI' : ''}</p>
        <div className="mp-hero__main">
          <div className="mp-hero__team">
            <Badge team={m.home} big />
            {m.home.id
              ? <a href={`#/team/${m.home.id}`} onClick={(e) => { e.preventDefault(); navigate(`/team/${m.home.id}`) }} className="mp-hero__name mp-hero__name--link">{m.home.n}</a>
              : <span className="mp-hero__name">{m.home.n}</span>}
          </div>
          <div className="mp-hero__center">
            {d.played ? (
              <strong className="mp-hero__score">{m.hs} <i>–</i> {m.as}</strong>
            ) : (
              <strong className="mp-hero__score mp-hero__score--vs">VS</strong>
            )}
            <span className={`mp-hero__status${live ? ' is-live' : ''}`}>{status}</span>
          </div>
          <div className="mp-hero__team">
            <Badge team={m.away} big />
            {m.away.id
              ? <a href={`#/team/${m.away.id}`} onClick={(e) => { e.preventDefault(); navigate(`/team/${m.away.id}`) }} className="mp-hero__name mp-hero__name--link">{m.away.n}</a>
              : <span className="mp-hero__name">{m.away.n}</span>}
          </div>
        </div>
        <div className="mp-hero__meta">
          <span>📍 {d.venue}</span>
          {d.refereeId
            ? <a
                href={`#/referee/${d.refereeId}`}
                onClick={(e) => { e.preventDefault(); navigate(`/referee/${d.refereeId}`) }}
                className="mp-reflink"
              >
                🧑‍⚖️ {d.referee}
              </a>
            : <span>🧑‍⚖️ {d.referee}</span>}
          <span>📅 {m.date}</span>
        </div>
      </header>

      {/* Tablar */}
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

      <div className="mp-content">
        {tab === 'sharh' && <Overview d={d} />}
        {tab === 'stat' && <Stats d={d} />}
        {tab === 'tarkib' && <Lineups d={d} />}
        {tab === 'jadval' && <Standings d={d} />}
      </div>
    </section>
  )
}
