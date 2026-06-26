import { useState } from 'react'
import { api, useApi } from '../api.js'
import { Loading, ErrorBox } from './States.jsx'
import { DAYS } from '../data/score.js'
import Crest from './Crest.jsx'
import Flag from './Flag.jsx'
import { matchTime } from '../settings.js'

function navigate(hash) {
  window.location.hash = hash
  window.scrollTo(0, 0)
}

function Badge({ name, c, id }) {
  return <Crest name={name} c={c} id={id} kind="team" size="sm" />
}

const TABS = [
  { key: 'jadval', label: 'Jadval' },
  { key: 'oyinlar', label: 'O\'yinlar' },
  { key: 'bomb', label: 'Bombardirlar' },
]

const SPLIT = [
  { key: 'all', label: 'Hammasi' },
  { key: 'home', label: 'Uyda' },
  { key: 'away', label: 'Mehmonda' },
]

function FormBadge({ r }) {
  const cls = r === 'G' ? 'is-w' : r === 'D' ? 'is-d' : 'is-l'
  return <span className={`lg-form ${cls}`}>{r}</span>
}

function zoneClass(pos, total) {
  if (pos <= 4) return 'is-cl'
  if (pos === 5) return 'is-el'
  if (pos > total - 3) return 'is-rel'
  return ''
}

function GroupTable({ group, split, multi }) {
  const rows = group.rows.map((r) => {
    const s = split === 'all' ? r.total : r[split]
    const P = s.w + s.d + s.l
    return { ...r, _P: P, _W: s.w, _D: s.d, _L: s.l, _Pts: s.w * 3 + s.d }
  })
  if (split !== 'all') rows.sort((a, b) => b._Pts - a._Pts || b.GD - a.GD)
  rows.forEach((r, i) => { r._pos = i + 1 })

  // Ko'p guruhli (Jahon chempionati) — yuqori 2 o'rin keyingi bosqichga
  const zone = (pos) => (multi ? (pos <= 2 ? 'is-cl' : '') : zoneClass(pos, rows.length))

  return (
    <div className="lg-group">
      {multi && <h3 className="lg-group__name">{group.name}</h3>}
      <table className="lg-table">
        <thead>
          <tr>
            <th>#</th><th className="lg-table__club">Klub</th>
            <th>O'</th><th>G'</th><th>D</th><th>M</th>
            <th className="lg-hide-sm">U-Z</th><th>F</th><th>O</th>
            <th className="lg-hide-sm">Forma</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td className={`lg-pos ${zone(r._pos)}`}>{r._pos}</td>
              <td className="lg-table__club">
                <a
                  href={`#/team/${r.id}`}
                  onClick={(e) => { e.preventDefault(); navigate(`/team/${r.id}`) }}
                  className="lg-club__link"
                >
                  <Badge name={r.name} c={r.c} id={r.id} />
                  <span className="lg-club__name">{r.name}</span>
                </a>
              </td>
              <td>{r._P}</td><td>{r._W}</td><td>{r._D}</td><td>{r._L}</td>
              <td className="lg-hide-sm">{r.GF}:{r.GA}</td>
              <td className={r.GD > 0 ? 'lg-gd-pos' : r.GD < 0 ? 'lg-gd-neg' : ''}>
                {r.GD > 0 ? '+' : ''}{r.GD}
              </td>
              <td className="lg-pts">{r._Pts}</td>
              <td className="lg-hide-sm">
                <span className="lg-forms">
                  {r.form.map((f, i) => <FormBadge key={i} r={f} />)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Standings({ data }) {
  const [split, setSplit] = useState('all')
  const groups = (data.groups && data.groups.length)
    ? data.groups
    : [{ name: '', rows: data.rows || [] }]
  const multi = groups.length > 1

  return (
    <div>
      <div className="lg-split">
        {SPLIT.map((s) => (
          <button
            key={s.key}
            className={`lg-split__btn${split === s.key ? ' is-sel' : ''}`}
            onClick={() => setSplit(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {groups.map((g, i) => (
        <GroupTable key={g.name || i} group={g} split={split} multi={multi} />
      ))}

      <div className="lg-legend">
        {multi ? (
          <span><i className="lg-dot is-cl" /> Keyingi bosqichga chiqadi</span>
        ) : (
          <>
            <span><i className="lg-dot is-cl" /> Chempionlar ligasi</span>
            <span><i className="lg-dot is-el" /> Yevropa ligasi</span>
            <span><i className="lg-dot is-rel" /> Tushish zonasi</span>
          </>
        )}
      </div>
    </div>
  )
}

function Matches({ list }) {
  if (!list || list.length === 0) return <p className="mp-empty">Bu liga uchun o'yinlar topilmadi.</p>

  const byDate = new Map()
  for (const m of list) {
    if (!byDate.has(m.date)) byDate.set(m.date, [])
    byDate.get(m.date).push(m)
  }
  const dayLabel = (d) => DAYS.find((x) => x.date === d)?.label || d

  return (
    <div className="lg-matches">
      {[...byDate.entries()].map(([date, ms]) => (
        <section key={date} className="lg-mday">
          <h4 className="mp-subtitle">{dayLabel(date)} · {date}</h4>
          {ms.map((m) => {
            const played = m.status === 'live' || m.status === 'ft'
            const status = m.status === 'live' ? `${m.minute}'` : m.status === 'ft' ? 'FT' : matchTime(m)
            return (
              <button
                key={m.id}
                className="lg-match"
                onClick={() => navigate(`/match/${m.id}`)}
              >
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
        </section>
      ))}
    </div>
  )
}

function Scorers({ list }) {
  return (
    <table className="lg-scorers">
      <thead>
        <tr><th>#</th><th className="lg-table__club">O'yinchi</th><th>Klub</th><th>G</th><th>U</th></tr>
      </thead>
      <tbody>
        {list.map((p) => (
          <tr key={p.rank}>
            <td className="lg-pos">{p.rank}</td>
            <td className="lg-table__club">{p.name}</td>
            <td><Badge name={p.team} c={p.c} id={p.teamId} /> <span className="lg-hide-sm">{p.team}</span></td>
            <td className="lg-pts">{p.goals}</td>
            <td>{p.assists}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SeasonPicker({ seasons, current, onPick }) {
  if (!seasons || seasons.length < 2) return null
  return (
    <div className="lg-seasons">
      {seasons.map((s) => (
        <button
          key={s.id}
          className={`lg-season${String(s.id) === String(current) ? ' is-sel' : ''}`}
          onClick={() => onPick(s.id)}
        >
          {s.year}
        </button>
      ))}
    </div>
  )
}

function StageBar({ stages }) {
  if (!stages || !stages.length) return null
  return (
    <div className="lg-stages">
      <div className="lg-stages__line" />
      {stages.map((s, i) => (
        <div key={i} className={`lg-stage${s.done ? ' is-done' : ''}${s.current ? ' is-now' : ''}`}>
          <span className="lg-stage__dot" />
          <span className="lg-stage__name">{s.name}</span>
        </div>
      ))}
    </div>
  )
}

export default function League({ id }) {
  const [tab, setTab] = useState('jadval')
  const [season, setSeason] = useState()
  const { data, loading, error } = useApi(() => api.league(id, season), [id, season])

  if (loading && !data) return <Loading />
  if (error || !data || !data.league) return <ErrorBox message={error} />

  const lg = data.league
  const curYear = data.seasons?.find((s) => String(s.id) === String(data.currentSeasonId))?.year
  return (
    <section className="lg">
      <a href="#/score" onClick={(e) => { e.preventDefault(); navigate('/score') }} className="article__back">
        ← Score
      </a>

      <header className="lg-hero">
        <span className="lg-hero__flag"><Flag value={lg.flag} /></span>
        <div>
          <p className="kicker">{lg.country}{curYear ? ` · MAVSUM ${curYear}` : ''}</p>
          <h1 className="lg-hero__name">{lg.name}</h1>
          <p className="lg-hero__sub">{data.teamCount} ta jamoa · {lg.country}</p>
        </div>
      </header>

      <SeasonPicker seasons={data.seasons} current={data.currentSeasonId} onPick={setSeason} />
      <StageBar stages={data.stages} />

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

      <div className="lg-content">
        {tab === 'jadval' && <Standings data={data} />}
        {tab === 'oyinlar' && <Matches list={data.matches} />}
        {tab === 'bomb' && <Scorers list={data.scorers} />}
      </div>
    </section>
  )
}
