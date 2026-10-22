// O'yin sahifasi sarlavhasi: jamoalar, hisob, holat, stadion/hakam/sana. Sahifadagi yagona h1 shu yerda.
import Crest from '../Crest.jsx'
import { Link } from '../../lib/nav.jsx'
import { fmtTashkentDate } from '../../lib/format.js'
import { dash } from '../league/shared.js'
import { heroStatus, matchTitle } from './matchModel.js'

function TeamName({ team }) {
  const name = dash(team?.n)
  if (team?.id == null) return <span className="mp-hero__name">{name}</span>
  return (
    <Link to={`/team/${encodeURIComponent(team.id)}`} className="mp-hero__name mp-hero__name--link">
      {name}
    </Link>
  )
}

function HeroTeam({ team }) {
  return (
    <div className="mp-hero__team">
      <Crest name={team?.n ?? ''} c={team?.c} id={team?.id ?? undefined} kind="team" size="lg" />
      <TeamName team={team} />
    </div>
  )
}

function LeagueKicker({ league, live }) {
  const name = league?.name || 'Turnir'
  return (
    <p className="kicker">
      {league?.country ? `${league.country} · ` : ''}
      {league?.id != null ? <Link to={`/league/${encodeURIComponent(league.id)}`}>{name}</Link> : name}
      {live ? ' · JONLI' : ''}
    </p>
  )
}

function MetaItem({ icon, label, children }) {
  return (
    <span>
      <span aria-hidden="true">{icon} </span>
      <span className="sr-only">{label}: </span>
      {children}
    </span>
  )
}

function HeroMeta({ d }) {
  const m = d.match
  const date = Number.isFinite(m.ts) ? fmtTashkentDate(m.ts * 1000) : m.date
  const referee =
    d.referee && d.refereeId != null ? (
      <Link to={`/referee/${encodeURIComponent(d.refereeId)}`} className="mp-reflink">
        {d.referee}
      </Link>
    ) : (
      d.referee
    )
  return (
    <div className="mp-hero__meta">
      {d.venue && (
        <MetaItem icon="📍" label="Stadion">
          {d.venue}
        </MetaItem>
      )}
      {d.referee && (
        <MetaItem icon="🧑‍⚖️" label="Hakam">
          {referee}
        </MetaItem>
      )}
      {date && (
        <MetaItem icon="📅" label="Sana">
          {date}
        </MetaItem>
      )}
    </div>
  )
}

/** @param {{ d: object }} props — /api/matches/:id javobi */
export default function MatchHero({ d }) {
  const m = d.match
  const live = m.status === 'live'
  return (
    <header className="mp-hero">
      <h1 className="sr-only">{matchTitle(m)}</h1>
      <LeagueKicker league={d.league} live={live} />
      <div className="mp-hero__main">
        <HeroTeam team={m.home} />
        <div className="mp-hero__center">
          {d.played ? (
            <strong className="mp-hero__score">
              {dash(m.hs)} <i aria-hidden="true">–</i>
              <span className="sr-only">:</span> {dash(m.as)}
            </strong>
          ) : (
            <strong className="mp-hero__score mp-hero__score--vs">VS</strong>
          )}
          <span className={`mp-hero__status${live ? ' is-live' : ''}`}>
            {live && <span className="sr-only">Jonli, </span>}
            {heroStatus(m)}
          </span>
        </div>
        <HeroTeam team={m.away} />
      </div>
      <HeroMeta d={d} />
    </header>
  )
}
