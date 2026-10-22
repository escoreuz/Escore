// Score ro'yxatidagi bitta o'yin qatori. Butun qator bosiladi (stretched-link), klaviaturada havola orqali.
import { memo } from 'react'
import Crest from '../Crest.jsx'
import { Link } from '../../lib/nav.jsx'
import { hasScore, isLive, scoreText, statusLabel, teamName } from './matchText.js'

function minuteClass(m) {
  if (isLive(m)) return 'sc-min sc-min--live'
  if (m.status === 'ft') return 'sc-min sc-min--ft'
  return 'sc-min'
}

function TeamLine({ team }) {
  return (
    <div className="sc-team">
      <Crest name={teamName(team)} c={team?.c} id={team?.id} kind="team" />
      <span className="sc-team__name">{teamName(team)}</span>
    </div>
  )
}

function ScoreDigits({ match: m }) {
  const played = hasScore(m)
  const cls = isLive(m) ? 'is-live' : undefined
  return (
    <div className="sc-score">
      <span className="sr-only">{scoreText(m)}</span>
      <span className={cls} aria-hidden="true">
        {played ? m.hs : '–'}
      </span>
      <span className={cls} aria-hidden="true">
        {played ? m.as : '–'}
      </span>
    </div>
  )
}

/**
 * @param {{ match: object, isFav: boolean, onFav: (id: string|number) => void }} props
 */
function ScoreRow({ match: m, isFav, onFav }) {
  const live = isLive(m)
  const pair = `${teamName(m.home)} – ${teamName(m.away)}`
  const favLabel = `${isFav ? 'Sevimlilardan olish' : "Sevimlilarga qo'shish"}: ${pair}`
  const linkable = m.id != null
  return (
    <div className={`sc-row${linkable ? ' is-linkrow' : ''}${live ? ' is-live' : ''}`}>
      <button
        type="button"
        className={`sc-star${isFav ? ' is-on' : ''}`}
        aria-pressed={isFav}
        aria-label={favLabel}
        onClick={() => onFav(m.id)}
      >
        <span aria-hidden="true">{isFav ? '★' : '☆'}</span>
      </button>
      <div className="sc-row__status">
        {live && <span className="sr-only">Jonli, </span>}
        <span className={minuteClass(m)}>{statusLabel(m)}</span>
      </div>
      <div className="sc-teams">
        <TeamLine team={m.home} />
        <TeamLine team={m.away} />
      </div>
      <ScoreDigits match={m} />
      {linkable && (
        <Link
          to={`/match/${encodeURIComponent(m.id)}`}
          className="stretched-link"
          aria-label={`O'yin sahifasi: ${scoreText(m)}`}
        />
      )}
    </div>
  )
}

export default memo(ScoreRow)
