import { useState } from 'react'
import { api, useApi } from '../api.js'
import { Loading, ErrorBox } from './States.jsx'
import { DAYS } from '../data/score.js'
import Crest from './Crest.jsx'
import Flag from './Flag.jsx'
import AdSlot from './AdSlot.jsx'
import { matchTime } from '../settings.js'

function navigate(hash) {
  window.location.hash = hash
  window.scrollTo(0, 0)
}

function initials(name) {
  const p = (name || '').trim().split(/\s+/)
  return (p.length > 1 ? p.slice(0, 2).map((x) => x[0]).join('') : (name || '').slice(0, 3)).toUpperCase()
}
function Badge({ name, c, id, kind = 'team' }) {
  return <Crest name={name} c={c} id={id} kind={kind} size="sm" />
}

const TABS = [
  { key: 'oyin', label: 'O\'yinlar' },
  { key: 'mavsum', label: 'Mavsum' },
  { key: 'karera', label: 'Karera' },
  { key: 'yangi', label: 'Yangiliklar' },
]

// 5 o'qli radar (pentagon)
function Radar({ attrs }) {
  const cx = 110, cy = 105, R = 84
  const n = attrs.length
  const pt = (i, r) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r]
  }
  const grid = [0.25, 0.5, 0.75, 1].map((f) =>
    attrs.map((_, i) => pt(i, R * f).join(',')).join(' ')
  )
  const poly = attrs.map((a, i) => pt(i, R * (a.val / 100)).join(',')).join(' ')

  return (
    <svg className="pl-radar" viewBox="0 0 220 220" width="220" height="220">
      {grid.map((g, i) => (
        <polygon key={i} points={g} fill="none" stroke="var(--line-soft)" strokeWidth="1" />
      ))}
      {attrs.map((_, i) => {
        const [x, y] = pt(i, R)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line-soft)" strokeWidth="1" />
      })}
      <polygon points={poly} fill="rgba(138,28,28,0.22)" stroke="var(--accent)" strokeWidth="2" />
      {attrs.map((a, i) => {
        const [x, y] = pt(i, R + 16)
        return (
          <text key={i} x={x} y={y} className="pl-radar__label" textAnchor="middle" dominantBaseline="middle">
            {a.label}
          </text>
        )
      })}
    </svg>
  )
}

function ratingColor(r) {
  if (r == null) return 'var(--line-soft)'
  if (r < 6) return '#c0392b'
  if (r < 6.5) return '#e08a1e'
  if (r < 7) return '#cdaa2e'
  return '#2e8b57'
}

// So'nggi 12 oy — oylik o'rtacha reyting (ustun diagramma)
function MonthlyChart({ data }) {
  if (!data || !data.some((d) => d.rating != null)) return null
  const min = 5.5, max = 8.0
  return (
    <section className="pl-monthly">
      <h4 className="mp-subtitle">So'nggi 12 oy — o'rtacha reyting</h4>
      <div className="pl-bars">
        {data.map((d, i) => {
          const h = d.rating == null ? 0 : ((d.rating - min) / (max - min)) * 100
          return (
            <div key={i} className="pl-bar">
              <div className="pl-bar__track">
                <span className="pl-bar__fill" style={{ height: Math.max(0, Math.min(100, h)) + '%', background: ratingColor(d.rating) }} />
              </div>
              <span className="pl-bar__val">{d.rating != null ? d.rating.toFixed(1) : '–'}</span>
              <span className="pl-bar__mon">{d.label}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// Mavsum xulosasi kartasi
function SeasonSummary({ s }) {
  if (!s) return null
  const cells = s.isGK
    ? [['O\'yinlar', s.appearances], ['Asosiy tarkib', s.started], ['⌀ Daqiqa', s.minutesPerGame], ['Jami daqiqa', s.totalMinutes], ['To\'xtatish', s.saves], ['Quruq o\'yin', s.cleanSheet]]
    : [['O\'yinlar', s.appearances], ['Asosiy tarkib', s.started], ['⌀ Daqiqa', s.minutesPerGame], ['Jami daqiqa', s.totalMinutes], ['Gollar', s.goals], ['Assistlar', s.assists]]
  return (
    <section className="pl-season">
      <h4 className="mp-subtitle">Mavsum xulosasi · {s.tournament} {s.season}</h4>
      <div className="pl-season__grid">
        <div className="pl-season__rating">
          <span className="pl-season__num">{s.rating}</span>
          <span className="pl-season__cap">O'rtacha reyting</span>
        </div>
        <div className="pl-season__cells">
          {cells.map(([k, v]) => (
            <div key={k} className="pl-scell">
              <span className="pl-scell__v">{v}</span>
              <span className="pl-scell__k">{k}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Overview({ p }) {
  return (
    <div className="pl-overview">
      <div className="pl-radarbox pl-radarbox--solo">
        <div className="pl-rating">
          <span className="pl-rating__num">{p.rating}</span>
          <span className="pl-rating__cap">O'rtacha reyting</span>
        </div>
        <Radar attrs={p.attrs} />
      </div>

      <MonthlyChart data={p.monthly} />

      <div className="pl-sw">
        <div className="pl-sw__col">
          <h4 className="mp-subtitle">Kuchli tomonlari</h4>
          <ul className="pl-tags">
            {p.strengths.map((s) => <li key={s} className="pl-tag is-strong">{s}</li>)}
          </ul>
        </div>
        <div className="pl-sw__col">
          <h4 className="mp-subtitle">Kuchsiz tomonlari</h4>
          <ul className="pl-tags">
            {p.weaknesses.map((s) => <li key={s} className="pl-tag is-weak">{s}</li>)}
          </ul>
        </div>
      </div>
    </div>
  )
}

function Stats({ p }) {
  return (
    <div className="pl-stats">
      {p.stats.map((grp) => (
        <section key={grp.group} className="pl-statgrp">
          <h4 className="mp-subtitle">{grp.group}</h4>
          <ul className="pl-statlist">
            {grp.rows.map(([k, v]) => (
              <li key={k}><span>{k}</span><strong>{v}</strong></li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

// ---- O'YINLAR tabi (boyitilgan: turnir + ikkala jamoa + natija + reyting) ----
function shortDate(d) {
  return d ? `${d.slice(8, 10)}.${d.slice(5, 7)}` : ''
}
function Matches({ p }) {
  if (!p.recent || p.recent.length === 0) return <p className="mp-empty">O'yinlar topilmadi.</p>
  return (
    <ul className="plm">
      {p.recent.map(({ m, result, rating }, i) => {
        const played = m.status === 'live' || m.status === 'ft'
        const status = m.status === 'ft' ? 'FT' : m.status === 'live' ? `${m.minute}'` : matchTime(m)
        return (
          <li key={m.id || i} className="plm-row" onClick={() => navigate(`/match/${m.id}`)} title={m.league?.name}>
            <span className="plm-comp"><Flag value={m.league?.flag} /></span>
            <span className="plm-date">{shortDate(m.date)}<i>{status}</i></span>
            <span className="plm-teams">
              <span className="plm-team"><Crest name={m.home.n} c={m.home.c} id={m.home.id} size="sm" /> {m.home.n}</span>
              <span className="plm-team"><Crest name={m.away.n} c={m.away.c} id={m.away.id} size="sm" /> {m.away.n}</span>
            </span>
            <span className="plm-score">
              {played ? <><b>{m.hs}</b><b>{m.as}</b></> : <><i>–</i><i>–</i></>}
            </span>
            {result
              ? <span className={`plm-res is-${result}`}>{result === 'G' ? 'G\'' : result}</span>
              : <span className="plm-res is-x" />}
            <span className="plm-rating" style={rating ? { background: ratingColor(+rating), color: '#fff' } : undefined}>
              {rating || '–'}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

// Mavsum issiqlik xaritasi (gorizontal maydon, o'yinchi darvozasi chapda)
function Heatmap({ points }) {
  if (!points || !points.length) return <p className="mp-empty">Issiqlik xaritasi mavjud emas.</p>
  const max = Math.max(...points.map((p) => p.count || 1))
  return (
    <div className="pls-pitch">
      <span className="pls-pitch__half" />
      <span className="pls-pitch__circle" />
      <span className="pls-pitch__box pls-pitch__box--l" />
      <span className="pls-pitch__box pls-pitch__box--r" />
      {points.map((pt, i) => {
        const t = (pt.count || 1) / max
        return (
          <span
            key={i}
            className="pls-dot"
            style={{ left: pt.x + '%', top: pt.y + '%', opacity: 0.2 + t * 0.55, transform: `translate(-50%,-50%) scale(${0.7 + t * 1.1})` }}
          />
        )
      })}
    </div>
  )
}

// Mavsum statistikasi ro'yxati (namunadagi "Matches" paneli)
function SeasonStats({ s }) {
  const rows = s.isGK
    ? [['Ishtiroklar', s.appearances], ['Asosiy tarkibda', s.started], ['O\'rtacha daqiqa', s.minutesPerGame], ['Jami daqiqa', s.totalMinutes], ['To\'xtatishlar', s.saves], ['Quruq o\'yin', s.cleanSheet]]
    : [['Ishtiroklar', s.appearances], ['Asosiy tarkibda', s.started], ['O\'rtacha daqiqa', s.minutesPerGame], ['Jami daqiqa', s.totalMinutes], ['Gollar', s.goals], ['Assistlar', s.assists]]
  return (
    <table className="pls-stats">
      <tbody>{rows.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody>
    </table>
  )
}

// ---- MAVSUM tabi (interaktiv: liga tanlash + reyting tasmasi + heatmap + statistika) ----
function SeasonTab({ p }) {
  const list = p.seasonsList || []
  const [sel, setSel] = useState(0)
  const cur = list[sel]
  const { data, loading } = useApi(
    () => (cur ? api.playerSeason(p.id, cur.tid, cur.sid) : Promise.resolve(null)),
    [p.id, sel]
  )

  if (!list.length) return <p className="mp-empty">Mavsum ma'lumoti topilmadi.</p>

  const summary = data?.summary
  const timeline = data?.timeline || []
  const heatmap = data?.heatmap || []
  const hasTimeline = timeline.some((t) => t.rating)

  return (
    <div className="pls">
      <header className="pls-head">
        <Crest name={cur.name} id={cur.tid} kind="tournament" size="sm" />
        <select className="pls-select" value={sel} onChange={(e) => setSel(+e.target.value)}>
          {list.map((x, i) => <option key={i} value={i}>{x.name} · {x.year}</option>)}
        </select>
        {summary && summary.rating !== '—' && (
          <span className="pls-avg" style={{ background: ratingColor(+summary.rating) }}>{summary.rating}</span>
        )}
      </header>

      {loading ? <Loading /> : !summary ? <p className="mp-empty">Ma'lumot topilmadi.</p> : (
        <>
          {hasTimeline && (
            <section className="pls-tl">
              <h4 className="mp-subtitle">O'rtacha reyting · o'yinma-o'yin</h4>
              <div className="pls-tl__row">
                {timeline.map((t, i) => (
                  <button key={i} className="pls-mtl" onClick={() => t.matchId && navigate(`/match/${t.matchId}`)} title={t.oppName || ''}>
                    <span className="pls-mtl__date">{t.date ? shortDate(t.date) : ''}</span>
                    {t.oppId
                      ? <Crest name={t.oppName} c={t.oppColor} id={t.oppId} size="sm" />
                      : <span className="pls-mtl__noopp">⚽</span>}
                    <span className="pls-mtl__rt" style={t.rating ? { background: ratingColor(+t.rating), color: '#fff' } : undefined}>{t.rating || '–'}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="pls-grid">
            <section>
              <h4 className="mp-subtitle">Mavsum issiqlik xaritasi</h4>
              <Heatmap points={heatmap} />
            </section>
            <section>
              <h4 className="mp-subtitle">O'yinlar statistikasi</h4>
              <SeasonStats s={summary} />
            </section>
          </div>
        </>
      )}
    </div>
  )
}

// ---- KARERA tabi (alohida yuklanadi) ----
function CareerTab({ id }) {
  const { data, loading, error } = useApi(() => api.playerCareer(id), [id])
  if (loading) return <Loading />
  if (error) return <ErrorBox message={error} />
  const rows = data?.rows || []
  const gk = data?.isGK
  if (!rows.length) return <p className="mp-empty">Karera ma'lumoti topilmadi.</p>
  return (
    <table className="plc">
      <thead>
        <tr>
          <th>Mavsum</th><th className="plc-comp">Turnir</th>
          <th>O'</th><th>Daq</th>
          {gk ? <><th>QO</th><th>O'tgan</th></> : <><th>G</th><th>A</th></>}
          <th>Reyting</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td className="plc-year">{r.year}</td>
            <td className="plc-comp">{r.tournament}</td>
            <td>{r.mp}</td><td>{r.min}</td>
            {gk ? <><td>{r.cls}</td><td>{r.gc}</td></> : <><td>{r.goals}</td><td>{r.assists}</td></>}
            <td><span className="plc-rating" style={{ background: ratingColor(+r.rating) }}>{r.rating}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ---- YANGILIKLAR tabi (tahririyat lentasidan o'yinchi/jamoa bo'yicha) ----
function NewsTab({ p }) {
  const { data, loading } = useApi(() => api.feed(), [])
  if (loading) return <Loading />
  const items = data?.items || []
  const tokens = [
    ...String(p.name).split(/\s+/).filter((t) => t.length > 3),
    p.team, p.base.country,
  ].filter(Boolean).map((t) => t.toLowerCase())
  const filtered = items.filter((n) => {
    const hay = `${n.title} ${n.subtitle}`.toLowerCase()
    return tokens.some((t) => hay.includes(t))
  })
  const list = filtered.length ? filtered : []
  if (!list.length) return <p className="mp-empty">Bu o'yinchi haqida hozircha yangilik yo'q.</p>
  return (
    <div className="nw-grid">
      {list.map((n) => (
        <article key={n.id} className="nw-card">
          <a className="nw-card__media" href={`#/news/${n.slug}`} onClick={(e) => { e.preventDefault(); navigate(`/news/${n.slug}`) }}>
            <img className="nw-card__img" src={n.image} alt="" loading="lazy" />
            {n.league && <span className="nw-card__league">{n.league}</span>}
          </a>
          <div className="nw-card__body">
            <a href={`#/news/${n.slug}`} onClick={(e) => { e.preventDefault(); navigate(`/news/${n.slug}`) }} className="nw-card__title">{n.title}</a>
            <div className="nw-card__meta"><span>{n.source}</span><span>{n.time}</span></div>
          </div>
        </article>
      ))}
    </div>
  )
}

export default function Player({ id }) {
  const [tab, setTab] = useState('oyin')
  const { data: p, loading, error } = useApi(() => api.player(id), [id])

  if (loading) return <Loading />
  if (error || !p) return <ErrorBox message={error} />

  return (
    <section className="pl">
      <a href="#/score" onClick={(e) => { e.preventDefault(); navigate('/score') }} className="article__back">
        ← Score
      </a>

      <div className="pl-wrap">
        <div className="pl-main">
        <header className="pl-hero">
        <span className="pl-hero__av" style={{ background: p.teamColor, position: 'relative', overflow: 'hidden' }}>
          {initials(p.name)}
          {p.id && (
            <img
              src={api.img('player', p.id)}
              alt=""
              onError={(e) => { e.target.style.display = 'none' }}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
        </span>
        <div className="pl-hero__info">
          <div className="pl-hero__top">
            <h1 className="pl-hero__name">{p.name}</h1>
            {p.followers && <span className="pl-hero__followers">{p.followers} obunachi</span>}
          </div>
          <p className="pl-hero__team">
            {p.teamId ? (
              <a
                href={`#/team/${p.teamId}`}
                onClick={(e) => { e.preventDefault(); navigate(`/team/${p.teamId}`) }}
                className="pl-hero__teamlink"
              >
                <Badge name={p.team} c={p.teamColor} id={p.teamId} /> {p.team}
              </a>
            ) : (
              <span><Badge name={p.team} c={p.teamColor} /> {p.team}</span>
            )}
          </p>
          <ul className="pl-meta">
            <li>{p.base.flag} {p.base.country}</li>
            {p.base.birth && <li>🎂 {p.base.birth} ({p.base.age})</li>}
            <li>🎯 {p.posLabel}</li>
            <li>📏 {p.base.height} sm</li>
            <li>🦶 {p.base.foot}</li>
            <li>👕 №{p.base.number}</li>
            {p.valueText && p.valueText !== '—' && <li>💶 {p.valueText}</li>}
          </ul>
        </div>
      </header>

        <div className="pl-grid2">
          <aside className="pl-side">
            <Overview p={p} />
          </aside>

          <div className="pl-tabsarea">
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
              {tab === 'oyin' && <Matches p={p} />}
              {tab === 'mavsum' && <SeasonTab p={p} />}
              {tab === 'karera' && <CareerTab id={p.id} />}
              {tab === 'yangi' && <NewsTab p={p} />}
            </div>
          </div>
        </div>
        </div>

        <aside className="ad-rail">
          <AdSlot label="Reklama" />
          <AdSlot label="Reklama" />
        </aside>
      </div>
    </section>
  )
}
