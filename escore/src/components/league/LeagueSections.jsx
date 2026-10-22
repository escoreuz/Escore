// Liga sahifasi bo'limlari: jadval (uy/mehmon bo'linishi bilan), o'yinlar, bombardirlar, mavsum va bosqichlar.
import { useState } from 'react'
import Crest from '../Crest.jsx'
import MatchRow from '../MatchRow.jsx'
import { Link } from '../../lib/nav.jsx'
import { fmtTashkentDate } from '../../lib/format.js'
import StandingsTable from './StandingsTable.jsx'
import Unavailable from './Unavailable.jsx'
import { dash, isUnavailable } from './shared.js'
import { groupsOf, standingsView } from './standings.js'

const SPLIT = [
  { id: 'all', label: 'Hammasi' },
  { id: 'home', label: 'Uyda' },
  { id: 'away', label: 'Mehmonda' },
]
const SPLIT_PART = { home: 'standings/home', away: 'standings/away' }
const MATCH_PARTS = ['matches/last', 'matches/next']
// 'YYYY-MM-DD' kun o'rtasi (UTC) — Toshkent vaqtida ham shu kun
const MIDDAY_UTC = 'T12:00:00Z'

function SplitButtons({ value, onChange }) {
  return (
    <div className="lg-split" role="group" aria-label="Jadval turi">
      {SPLIT.map(s => (
        <button
          key={s.id}
          type="button"
          aria-pressed={value === s.id}
          className={`lg-split__btn${value === s.id ? ' is-sel' : ''}`}
          onClick={() => onChange(s.id)}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}

/** @param {{ data: object }} props — /api/leagues/:id javobi */
export function LeagueStandings({ data }) {
  const [split, setSplit] = useState('all')
  const groups = groupsOf(data)
  const multi = groups.length > 1
  const leagueName = data.league?.name || 'Turnir'
  const splitLabel = SPLIT.find(s => s.id === split).label.toLowerCase()
  const note = <Unavailable meta={data.meta} parts={['standings']} label="Jadval" />
  if (!groups.length) {
    return (
      <div>
        {note}
        {!isUnavailable(data.meta, ['standings']) && <p className="mp-empty">Bu turnir uchun jadval mavjud emas.</p>}
      </div>
    )
  }
  return (
    <div>
      {note}
      <SplitButtons value={split} onChange={setSplit} />
      {split !== 'all' && <Unavailable meta={data.meta} parts={[SPLIT_PART[split]]} label="Uy/mehmon jadvali" />}
      {groups.map((g, i) => {
        const groupName = g.name || `${i + 1}-guruh`
        return (
          <div key={g.name || i} className="lg-group">
            {multi && <h2 className="lg-group__name">{groupName}</h2>}
            <StandingsTable
              rows={standingsView(g.rows, split)}
              caption={`${leagueName}${multi ? `, ${groupName}` : ''}: jadval (${splitLabel})`}
              showForm
            />
          </div>
        )
      })}
    </div>
  )
}

function dayLabel(date) {
  if (!date) return "Sana noma'lum"
  return fmtTashkentDate(`${date}${MIDDAY_UTC}`, { weekday: true }) || date
}

// Sana bo'yicha guruhlash (yangi Map, kirish massivi o'zgarmaydi)
function byDate(list) {
  const out = new Map()
  for (const m of list) {
    const key = m.date || ''
    out.set(key, [...(out.get(key) || []), m])
  }
  return [...out.entries()]
}

/** @param {{ list?: object[], meta?: object }} props */
export function LeagueMatches({ list, meta }) {
  const items = Array.isArray(list) ? list.filter(m => m && m.id != null) : []
  const note = <Unavailable meta={meta} parts={MATCH_PARTS} label="O'yinlar" />
  if (!items.length) {
    return (
      <div>
        {note}
        {!isUnavailable(meta, MATCH_PARTS) && <p className="mp-empty">Bu liga uchun o'yinlar topilmadi.</p>}
      </div>
    )
  }
  return (
    <div className="lg-matches">
      {note}
      {byDate(items).map(([date, ms]) => (
        <section key={date || 'none'} className="lg-mday">
          <h2 className="mp-subtitle">{dayLabel(date)}</h2>
          {ms.map(m => (
            <MatchRow key={m.id} match={m} />
          ))}
        </section>
      ))}
    </div>
  )
}

function ScorerRow({ p }) {
  return (
    <tr>
      <td className="lg-pos">{dash(p.rank)}</td>
      <th scope="row" className="lg-table__club">
        {p.id != null ? <Link to={`/player/${encodeURIComponent(p.id)}`}>{dash(p.name)}</Link> : dash(p.name)}
      </th>
      <td>
        <span className="lg-club__inner">
          <Crest name={p.team} c={p.c} id={p.teamId ?? undefined} kind="team" size="sm" />
          <span>{dash(p.team)}</span>
        </span>
      </td>
      <td className="lg-pts">{dash(p.goals)}</td>
      <td>{dash(p.assists)}</td>
    </tr>
  )
}

function ScorersTable({ items, caption }) {
  return (
    <div className="table-scroll" role="region" aria-label={caption} tabIndex={0}>
      <table className="lg-scorers">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">
              <abbr title="O'rin">#</abbr>
            </th>
            <th scope="col" className="lg-table__club">
              O'yinchi
            </th>
            <th scope="col">Klub</th>
            <th scope="col">
              <abbr title="Gollar">G</abbr>
            </th>
            <th scope="col">
              <abbr title="Golli uzatmalar">U</abbr>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((p, i) => (
            <ScorerRow key={p.id ?? `${p.name}-${i}`} p={p} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** @param {{ list?: object[], meta?: object, leagueName: string }} props */
export function LeagueScorers({ list, meta, leagueName }) {
  const items = Array.isArray(list) ? list.filter(Boolean) : []
  return (
    <div>
      <Unavailable meta={meta} parts={['scorers']} label="Bombardirlar" />
      {items.length === 0 && !isUnavailable(meta, ['scorers']) && (
        <p className="mp-empty">Bombardirlar ro'yxati mavjud emas.</p>
      )}
      {items.length > 0 && <ScorersTable items={items} caption={`${leagueName}: bombardirlar`} />}
    </div>
  )
}

/** @param {{ seasons?: object[], current?: string|number|null, onPick: (id: any) => void }} props */
export function SeasonPicker({ seasons, current, onPick }) {
  if (!Array.isArray(seasons) || seasons.length < 2) return null
  return (
    <div className="lg-seasons" role="group" aria-label="Mavsum">
      {seasons.map(s => {
        const selected = current != null && String(s.id) === String(current)
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={selected}
            className={`lg-season${selected ? ' is-sel' : ''}`}
            onClick={() => onPick(s.id)}
          >
            {dash(s.year)}
          </button>
        )
      })}
    </div>
  )
}

/** @param {{ stages?: { name: string, done?: boolean, current?: boolean }[] | null }} props */
export function StageBar({ stages }) {
  if (!Array.isArray(stages) || !stages.length) return null
  return (
    <div className="lg-stages" role="group" aria-label="Turnir bosqichlari">
      <div className="lg-stages__line" aria-hidden="true" />
      {stages.map((s, i) => (
        <div
          key={i}
          className={`lg-stage${s.done ? ' is-done' : ''}${s.current ? ' is-now' : ''}`}
          aria-current={s.current ? 'step' : undefined}
        >
          <span className="lg-stage__dot" aria-hidden="true" />
          <span className="lg-stage__name">{dash(s.name)}</span>
          {(s.done || s.current) && <span className="sr-only">{s.current ? ' (joriy)' : " (o'tgan)"}</span>}
        </div>
      ))}
    </div>
  )
}
