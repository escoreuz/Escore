import { useState, useEffect, useMemo } from 'react'
import { TODAY, DAYS } from '../data/score.js'
import { api, useApi } from '../api.js'
import Crest from './Crest.jsx'
import Flag from './Flag.jsx'
import ScoreSidebar from './ScoreSidebar.jsx'
import { matchTime } from '../settings.js'

function navigate(hash) {
  window.location.hash = hash
  window.scrollTo(0, 0)
}

function initials(name) {
  const parts = name.trim().split(/\s+/)
  if (parts.length > 1) return parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase()
  return name.slice(0, 3).toUpperCase()
}

function Badge({ team }) {
  return <Crest name={team.n} c={team.c} id={team.id} kind="team" />
}

const TABS = [
  { key: 'all', label: 'Hammasi' },
  { key: 'live', label: 'Jonli' },
  { key: 'ft', label: 'Tugagan' },
  { key: 'sched', label: 'Rejada' },
]

function MatchRow({ m, isFav, onFav }) {
  const live = m.status === 'live'
  const minute = m.minute
  const played = m.status === 'live' || m.status === 'ft'

  let statusEl
  if (live) statusEl = <span className="sc-min sc-min--live">{minute}'</span>
  else if (m.status === 'ft') statusEl = <span className="sc-min sc-min--ft">FT</span>
  else statusEl = <span className="sc-min">{matchTime(m)}</span>

  return (
    <div
      className={`sc-row sc-row--link${live ? ' is-live' : ''}`}
      onClick={() => navigate(`/match/${m.id}`)}
      title="O'yin tafsilotini ochish"
    >
      <button
        className={`sc-star${isFav ? ' is-on' : ''}`}
        onClick={(e) => { e.stopPropagation(); onFav(m.id) }}
        title={isFav ? 'Sevimlilardan olish' : 'Sevimlilarga qo\'shish'}
        aria-pressed={isFav}
      >
        {isFav ? '★' : '☆'}
      </button>

      <div className="sc-status">{statusEl}</div>

      <div className="sc-teams">
        <div className="sc-team">
          <Badge team={m.home} />
          <span className="sc-team__name">{m.home.n}</span>
        </div>
        <div className="sc-team">
          <Badge team={m.away} />
          <span className="sc-team__name">{m.away.n}</span>
        </div>
      </div>

      <div className="sc-score">
        {played ? (
          <>
            <span className={live ? 'is-live' : ''}>{m.hs}</span>
            <span className={live ? 'is-live' : ''}>{m.as}</span>
          </>
        ) : (
          <><span>–</span><span>–</span></>
        )}
      </div>
    </div>
  )
}

function MiniCalendar({ selected, onPick }) {
  // 2026-yil iyun: 1-iyun = dushanba
  const firstDow = 0 // Du=0 ... Ya=6 (1-iyun dushanba)
  const daysInMonth = 30
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  const selDay = parseInt(selected.slice(-2), 10)
  const hasData = new Set(DAYS.map((x) => parseInt(x.d, 10)))

  return (
    <div className="sc-cal">
      <div className="sc-cal__head">
        <span>‹</span>
        <strong>IYUN 2026</strong>
        <span>›</span>
      </div>
      <div className="sc-cal__grid sc-cal__dow">
        {['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'].map((w) => <span key={w}>{w}</span>)}
      </div>
      <div className="sc-cal__grid">
        {cells.map((d, i) => (
          <button
            key={i}
            className={[
              'sc-cal__cell',
              d == null ? 'is-empty' : '',
              d === selDay ? 'is-sel' : '',
              d && hasData.has(d) ? 'has-data' : '',
            ].join(' ')}
            disabled={d == null || !hasData.has(d)}
            onClick={() => d && hasData.has(d) && onPick(`2026-06-${String(d).padStart(2, '0')}`)}
          >
            {d || ''}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Score() {
  const [days, setDays] = useState(DAYS)
  const [today, setToday] = useState(TODAY)
  const [date, setDate] = useState(TODAY)
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [favs, setFavs] = useState(() => new Set())

  const [matches, setMatches] = useState([])
  const [liveCount, setLiveCount] = useState(0)
  const [featured, setFeatured] = useState(null)
  const { data: scorers } = useApi(() => api.scorers(), [])
  const { data: standingsMini } = useApi(() => api.standingsMini(), [])

  // Kun tasmasini serverdan olish (bugun ± 2) — birinchi yuklanishda
  useEffect(() => {
    let alive = true
    api.days().then((d) => {
      if (!alive || !d?.days?.length) return
      setDays(d.days)
      setToday(d.today)
      setDate(d.today)
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  // O'yinlarni serverdan olish + har 8s yangilash (jonli daqiqalar serverda yuriydi)
  useEffect(() => {
    let alive = true
    const load = () =>
      api.matches({ date, status: tab, q: query })
        .then((r) => { if (alive) { setMatches(r.matches); if (r.liveCount != null) setLiveCount(r.liveCount) } })
        .catch(() => {})
    load()
    const id = setInterval(load, 8000)
    return () => { alive = false; clearInterval(id) }
  }, [date, tab, query])

  // Tanlangan o'yin — jonli yangilanadi
  useEffect(() => {
    let alive = true
    const load = () => api.featured().then((f) => { if (alive) setFeatured(f) }).catch(() => {})
    load()
    const id = setInterval(load, 8000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  const toggleFav = (id) =>
    setFavs((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  // Liga bo'yicha guruhlash (server allaqachon sana/holat/qidiruv bo'yicha filtrlagan)
  const groups = useMemo(() => {
    const map = new Map()
    for (const m of matches) {
      if (!map.has(m.leagueId)) map.set(m.leagueId, [])
      map.get(m.leagueId).push(m)
    }
    return [...map.entries()]
  }, [matches])


  return (
    <section className="score">
      <header className="score__head">
        <p className="kicker">JONLI HISOB · SCORE MARKAZI</p>
        <h1 className="score__title">Score — Jonli natijalar</h1>
        <p className="score__standfirst">
          Barcha ligalardan jonli hisoblar, dasturlar va natijalar — bir joyda,
          gazetamizning bosma uslubida.
        </p>
      </header>

      {/* Sana tasmasi */}
      <div className="sc-days">
        {days.map((day) => (
          <button
            key={day.date}
            className={`sc-day${date === day.date ? ' is-sel' : ''}`}
            onClick={() => setDate(day.date)}
          >
            <span className="sc-day__dow">{day.dow}</span>
            <span className="sc-day__d">{day.d}</span>
            <span className="sc-day__label">{day.date === today ? 'Bugun' : day.label}</span>
          </button>
        ))}
      </div>

      {/* Asboblar paneli */}
      <div className="sc-toolbar">
        <div className="sc-tabs">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              className={`sc-tab${tab === tb.key ? ' is-sel' : ''}`}
              onClick={() => setTab(tb.key)}
            >
              {tb.label}
              {tb.key === 'live' && liveCount > 0 && <span className="sc-tab__badge">{liveCount}</span>}
            </button>
          ))}
        </div>

        <div className="sc-toolbar__right">
          <input
            className="sc-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jamoa qidirish…"
            aria-label="Jamoa qidirish"
          />
        </div>
      </div>

      <div className="sc-grid">
        {/* CHAP PANEL */}
        <aside className="sc-left">
          <MiniCalendar selected={date} onPick={setDate} />
          <ScoreSidebar />
        </aside>

        {/* MARKAZ — o'yinlar */}
        <div className="sc-center">
          {groups.length === 0 ? (
            <p className="sc-empty">Bu sana/filtr bo'yicha o'yinlar topilmadi.</p>
          ) : (
            groups.map(([lid, list]) => {
              const lg = list[0].league
              return (
                <section key={lid} className="sc-block">
                  <header
                    className="sc-block__head sc-block__head--link"
                    onClick={() => navigate(`/league/${lid}`)}
                    title="Liga haqida ma'lumot"
                  >
                    <span className="sc-block__flag"><Flag value={lg.flag} /></span>
                    <span className="sc-block__name">{lg.country} · {lg.name}</span>
                    <span className="sc-block__count">{list.length} o'yin ›</span>
                  </header>
                  {list.map((m) => (
                    <MatchRow
                      key={m.id}
                      m={m}
                      isFav={favs.has(m.id)}
                      onFav={toggleFav}
                    />
                  ))}
                </section>
              )
            })
          )}
        </div>

        {/* O'NG PANEL */}
        <aside className="sc-right">
          {featured && (
            <section className="box">
              <h4 className="box__title">TANLANGAN O'YIN</h4>
              <div className="sc-featured">
                <span className="sc-featured__league">
                  Premyer-liga · {featured.status === 'live' ? 'Jonli' : featured.status === 'ft' ? 'Tugadi' : 'Rejada'}
                </span>
                <div className="sc-featured__row">
                  <div className="sc-featured__team">
                    <Badge team={featured.home} />
                    <span>{featured.home.n}</span>
                  </div>
                  <div className="sc-featured__score">
                    <strong>{featured.hs} – {featured.as}</strong>
                    {featured.status === 'live' && <span className="sc-min sc-min--live">{featured.minute}'</span>}
                  </div>
                  <div className="sc-featured__team">
                    <Badge team={featured.away} />
                    <span>{featured.away.n}</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="box">
            <h4 className="box__title">BOMBARDIRLAR</h4>
            <ul className="sc-scorers">
              {(scorers || []).map((p) => (
                <li
                  key={p.rank}
                  className={`sc-scorer${p.id ? ' sc-scorer--link' : ''}`}
                  onClick={() => p.id && navigate(`/player/${p.id}`)}
                  title={p.id ? "O'yinchi haqida ma'lumot" : ''}
                >
                  <span className="sc-scorer__rank">{p.rank}</span>
                  <Crest name={p.team} c={p.c} id={p.id} kind="player" size="sm" />
                  <span className="sc-scorer__name">{p.name}</span>
                  <span className="sc-scorer__goals">{p.goals}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="box">
            <h4 className="box__title">JADVAL (TOP-5)</h4>
            <ul className="sc-ministand">
              {(standingsMini || []).map((r) => (
                <li key={r.pos}>
                  <span className="sc-ministand__pos">{r.pos}</span>
                  <span className="sc-ministand__club">{r.club}</span>
                  <span className="sc-ministand__pts">{r.pts}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </section>
  )
}
