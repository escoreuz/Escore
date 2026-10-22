// O'yin sahifasi tab bo'limlari: sharh (ovoz, voqealar, momentum), statistika, tarkiblar.
import { Link } from '../../lib/nav.jsx'
import { readableTextColor } from '../../lib/color.js'
import { matchTime } from '../../settings.js'
import Unavailable from '../league/Unavailable.jsx'
import { dash, isUnavailable } from '../league/shared.js'
import { pitchDots, statShare, votePct } from './matchModel.js'

const EVENT_META = {
  goal: { icon: '⚽', label: 'Gol' },
  yellow: { icon: '🟨', label: 'Sariq kartochka' },
  red: { icon: '🟥', label: 'Qizil kartochka' },
}

const pct = v => `${v}%`
// Jamoa rangi ustidagi matn: yorqinlikka qarab qora/oq (tanilmagan rang → CSS standarti)
const textOn = c => readableTextColor(c) ?? undefined

function EventIcon({ type }) {
  const meta = typeof type === 'string' && Object.hasOwn(EVENT_META, type) ? EVENT_META[type] : null
  if (!meta) return null
  return (
    <>
      <span className="mp-event__ic" aria-hidden="true">
        {meta.icon}
      </span>
      <span className="sr-only">{meta.label}: </span>
    </>
  )
}

function EventText({ e, iconFirst }) {
  const assist = e.assist ? ` (${e.assist})` : ''
  return (
    <span className="mp-event__txt">
      {iconFirst && <EventIcon type={e.type} />}
      <strong>{dash(e.player)}</strong>
      {assist} {!iconFirst && <EventIcon type={e.type} />}
    </span>
  )
}

function Events({ d }) {
  const events = Array.isArray(d.events) ? d.events : []
  return (
    <>
      <h2 className="mp-subtitle">O'yin voqealari</h2>
      <Unavailable meta={d.meta} parts={['events']} />
      {events.length === 0 && !isUnavailable(d.meta, ['events']) && (
        <p className="mp-empty">Voqealar qayd etilmagan.</p>
      )}
      {events.length > 0 && (
        <ul className="mp-events">
          {events.map((e, i) => (
            <li key={`${e.min}-${e.team}-${e.type}-${i}`} className={`mp-event mp-event--${e.team}`}>
              <div className="mp-event__home">{e.team === 'home' && <EventText e={e} />}</div>
              <span className="mp-event__min">{dash(e.min)}'</span>
              <div className="mp-event__away">{e.team === 'away' && <EventText e={e} iconFirst />}</div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function Momentum({ d }) {
  const bars = (Array.isArray(d.momentum) ? d.momentum : []).filter(Number.isFinite)
  const unavailable = isUnavailable(d.meta, ['momentum'])
  // Ma'lumot ham, xato ham yo'q — bo'sh sarlavha chiqarilmaydi
  if (!bars.length && !unavailable) return null
  const homeBars = bars.filter(v => v >= 0).length
  const home = dash(d.match.home?.n)
  const away = dash(d.match.away?.n)
  const label = `Hujum momentumi grafigi: ${home} ustun — ${homeBars} bo'lak, ${away} ustun — ${bars.length - homeBars} bo'lak`
  return (
    <>
      <h2 className="mp-subtitle">Hujum momentumi</h2>
      <Unavailable meta={d.meta} parts={['momentum']} />
      {bars.length > 0 && (
        <div className="mp-momentum" role="img" aria-label={label}>
          {bars.map((v, i) => (
            <span
              key={i}
              className={`mp-mbar ${v >= 0 ? 'is-home' : 'is-away'}`}
              style={{
                height: pct(Math.min(100, Math.abs(v))),
                background: v >= 0 ? d.match.home?.c : d.match.away?.c,
              }}
            />
          ))}
        </div>
      )}
    </>
  )
}

/** Kim yutadi bloki — vote null yoki yaroqsiz bo'lsa ko'rsatilmaydi. */
export function VoteBar({ d }) {
  const v = votePct(d.vote)
  if (!v) return null
  const { home, away } = d.match
  return (
    <div className="mp-vote">
      <h2 className="mp-subtitle">Kim yutadi?</h2>
      <div className="mp-vote__bar">
        <span
          className="mp-vote__seg is-home"
          style={{ width: pct(v.home), background: home?.c, color: textOn(home?.c) }}
        >
          {pct(v.home)}
        </span>
        <span className="mp-vote__seg is-draw" style={{ width: pct(v.draw) }}>
          {pct(v.draw)}
        </span>
        <span
          className="mp-vote__seg is-away"
          style={{ width: pct(v.away), background: away?.c, color: textOn(away?.c) }}
        >
          {pct(v.away)}
        </span>
      </div>
      <div className="mp-vote__labels">
        <span>{dash(home?.n)}</span>
        <span>Durang</span>
        <span>{dash(away?.n)}</span>
      </div>
    </div>
  )
}

function preMatchText(m) {
  if (m.status === 'canceled') return "O'yin bekor qilindi."
  if (m.status === 'postponed') return "O'yin keyinga qoldirildi."
  return (
    <>
      O'yin hali boshlanmagan. Boshlanish vaqti: <strong>{matchTime(m) || dash(null)}</strong>
    </>
  )
}

export function Overview({ d }) {
  if (!d.played) {
    return (
      <div className="mp-pre">
        <p className="mp-pre__msg">{preMatchText(d.match)}</p>
        <VoteBar d={d} />
      </div>
    )
  }
  return (
    <div>
      <VoteBar d={d} />
      <Events d={d} />
      <Momentum d={d} />
    </div>
  )
}

function StatRow({ s, d }) {
  const label = String(s.label ?? '')
  const unit = label.includes('%') ? '%' : ''
  const share = statShare(s.home, s.away)
  const val = v => (v == null || v === '' ? dash(null) : `${v}${unit}`)
  return (
    <div className="mp-stat">
      <div className="mp-stat__row">
        <span className="mp-stat__val">{val(s.home)}</span>
        <span className="mp-stat__label">{label.replace(', %', '') || dash(null)}</span>
        <span className="mp-stat__val">{val(s.away)}</span>
      </div>
      {share && (
        <div className="mp-stat__bar" aria-hidden="true">
          <span className="mp-stat__fill is-home" style={{ width: pct(share.home), background: d.match.home?.c }} />
          <span className="mp-stat__fill is-away" style={{ width: pct(share.away), background: d.match.away?.c }} />
        </div>
      )}
    </div>
  )
}

export function Stats({ d }) {
  const stats = Array.isArray(d.stats) ? d.stats.filter(Boolean) : []
  if (!d.played) return <p className="mp-empty">Statistika o'yin boshlangach paydo bo'ladi.</p>
  return (
    <div className="mp-stats">
      <Unavailable meta={d.meta} parts={['stats']} />
      {stats.length === 0 && !isUnavailable(d.meta, ['stats']) && <p className="mp-empty">Statistika mavjud emas.</p>}
      {stats.map((s, i) => (
        <StatRow key={`${s.label}-${i}`} s={s} d={d} />
      ))}
    </div>
  )
}

function PitchSide({ lineup, side, team }) {
  return pitchDots(lineup, side).map((p, i) => (
    <span
      key={side + i}
      className={`mp-dot mp-dot--${side}`}
      style={{ left: pct(p.x), top: pct(p.y), background: team?.c, color: textOn(team?.c) }}
    >
      {p.n || ''}
    </span>
  ))
}

function Pitch({ d, lineups }) {
  const part = (team, lineup) => [dash(team?.n), lineup.formation].filter(Boolean).join(' ')
  const label = `Maydondagi tarkiblar: ${part(d.match.home, lineups.home)}, ${part(d.match.away, lineups.away)}`
  return (
    <div className="mp-pitch" role="img" aria-label={label}>
      <div className="mp-pitch__line" />
      <div className="mp-pitch__circle" />
      <PitchSide lineup={lineups.home} side="home" team={d.match.home} />
      <PitchSide lineup={lineups.away} side="away" team={d.match.away} />
    </div>
  )
}

function TeamSheet({ team, lineup }) {
  const players = Array.isArray(lineup?.players) ? lineup.players : []
  return (
    <div className="mp-sheet">
      <header className="mp-sheet__head">
        <span className="mp-sheet__name">{dash(team?.n)}</span>
        <span className="mp-sheet__form">{lineup?.formation || ''}</span>
      </header>
      <ul className="mp-sheet__list">
        {players.map((p, i) => (
          <li
            key={`${p.id ?? ''}-${p.n}-${i}`}
            className={`mp-sheet__row ${p.id != null ? 'is-linkrow' : 'is-static'}`}
          >
            <span className="mp-sheet__num">{p.n || dash(null)}</span>
            {p.id != null ? (
              <Link to={`/player/${encodeURIComponent(p.id)}`} className="mp-sheet__pname stretched-link">
                {dash(p.name)}
              </Link>
            ) : (
              <span className="mp-sheet__pname">{dash(p.name)}</span>
            )}
            <span className="mp-sheet__pos">{dash(p.pos)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Lineups({ d }) {
  const lineups = { home: d.lineups?.home || {}, away: d.lineups?.away || {} }
  const has = side => Array.isArray(lineups[side].players) && lineups[side].players.length > 0
  const any = has('home') || has('away')
  return (
    <div>
      <Unavailable meta={d.meta} parts={['lineups']} />
      {!any && !isUnavailable(d.meta, ['lineups']) && <p className="mp-empty">Tarkiblar hali e'lon qilinmagan.</p>}
      {any && (
        <>
          <Pitch d={d} lineups={lineups} />
          <div className="mp-sheets">
            <TeamSheet team={d.match.home} lineup={lineups.home} />
            <TeamSheet team={d.match.away} lineup={lineups.away} />
          </div>
        </>
      )}
    </div>
  )
}
