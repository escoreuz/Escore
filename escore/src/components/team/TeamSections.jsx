// Jamoa sahifasi bo'limlari: umumiy ma'lumot (forma bilan), tarkib, o'yinlar.
import MatchRow from '../MatchRow.jsx'
import { FormList } from '../FormBadge.jsx'
import { Link } from '../../lib/nav.jsx'
import Unavailable from '../league/Unavailable.jsx'
import { dash, isKnown, isUnavailable } from '../league/shared.js'

const MATCH_PARTS = ['matches/last', 'matches/next']

function LeagueLink({ t }) {
  const name = t.league?.name || 'Turnir'
  if (t.leagueId == null) return name
  return <Link to={`/league/${encodeURIComponent(t.leagueId)}`}>{name}</Link>
}

function CoachCell({ info }) {
  if (!isKnown(info?.coach)) return dash(null)
  if (info.coachId == null) return info.coach
  return (
    <Link to={`/coach/${encodeURIComponent(info.coachId)}`} className="tm-coachlink">
      {info.coach} <span aria-hidden="true">›</span>
    </Link>
  )
}

/** Faqat ma'lum faktlardan tuzilgan qisqa tavsif (uydirma bo'lak qo'shilmaydi). */
export function aboutText(t) {
  const info = t.info || {}
  const league = t.league?.name
  const parts = [`${dash(t.name)}${isKnown(t.country) ? ` — ${t.country}` : ''}${league ? ` ${league} vakili` : ''}.`]
  if (isKnown(info.founded)) parts.push(`Jamoa ${info.founded}-yilda tashkil etilgan.`)
  if (isKnown(info.stadium)) parts.push(`O'z o'yinlarini ${info.stadium} stadionida o'tkazadi.`)
  if (isKnown(info.coach)) parts.push(`Bosh murabbiy — ${info.coach}.`)
  return parts.join(' ')
}

export function TeamOverview({ t }) {
  const info = t.info || {}
  const rows = [
    ['Liga', <LeagueLink key="l" t={t} />],
    ['Mamlakat', dash(t.country)],
    ["Joriy o'rin", t.standing != null ? `${t.standing}-o'rin` : dash(null)],
    ['Stadion', isKnown(info.stadium) ? info.stadium : dash(null)],
    ['Shahar', isKnown(info.city) ? info.city : dash(null)],
    ['Bosh murabbiy', <CoachCell key="c" info={info} />],
    ['Tashkil etilgan', dash(info.founded)],
  ]
  return (
    <div className="tm-overview">
      <div className="tm-form">
        <span className="tm-form__label">Oxirgi 5 o'yin:</span>
        <FormList form={t.form} />
      </div>
      <table className="tm-info">
        <caption className="sr-only">Jamoa haqida ma'lumot</caption>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th scope="row">{k}</th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="tm-about">{aboutText(t)}</p>
    </div>
  )
}

function PlayerItem({ p }) {
  const linked = p.id != null
  return (
    <li className={`tm-player${linked ? ' tm-player--link is-linkrow' : ''}`}>
      <span className="tm-player__num">{dash(p.n)}</span>
      <span className="tm-player__flag" aria-hidden="true">
        {p.flag || ''}
      </span>
      {linked ? (
        <Link to={`/player/${encodeURIComponent(p.id)}`} className="tm-player__name stretched-link">
          {dash(p.name)}
        </Link>
      ) : (
        <span className="tm-player__name">{dash(p.name)}</span>
      )}
      <span className="tm-player__pos">{dash(p.pos)}</span>
      <span className="tm-player__age">{p.age != null ? `${p.age} yosh` : dash(null)}</span>
    </li>
  )
}

export function Squad({ t }) {
  const groups = Array.isArray(t.squad) ? t.squad.filter(g => g && Array.isArray(g.players)) : []
  return (
    <div className="tm-squad">
      <Unavailable meta={t.meta} parts={['squad']} label="Tarkib" />
      {groups.length === 0 && !isUnavailable(t.meta, ['squad']) && <p className="mp-empty">Tarkib ma'lumoti yo'q.</p>}
      {groups.map((group, gi) => (
        <section key={group.label || gi} className="tm-group">
          <h2 className="mp-subtitle">{dash(group.label)}</h2>
          <ul className="tm-players">
            {group.players.map((p, i) => (
              <PlayerItem key={p.id ?? `${p.n}-${p.name}-${i}`} p={p} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export function TeamMatches({ t }) {
  const list = Array.isArray(t.matches) ? t.matches.filter(m => m && m.id != null) : []
  return (
    <div className="lg-matches">
      <Unavailable meta={t.meta} parts={MATCH_PARTS} label="O'yinlar" />
      {list.length === 0 && !isUnavailable(t.meta, MATCH_PARTS) && (
        <p className="mp-empty">Bu jamoa uchun o'yinlar topilmadi.</p>
      )}
      {list.map(m => (
        <MatchRow key={m.id} match={m} />
      ))}
      {list.length > 0 && <p className="tm-hint">O'yinni ochish uchun qatorni bosing</p>}
    </div>
  )
}
