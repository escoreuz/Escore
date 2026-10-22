// "O'yinlar" tabi: o'yinchining so'nggi o'yinlari (turnir, jamoalar, natija, shaxsiy reyting).
// Butun qator bosiladi: qator `is-linkrow`, hisob katagi esa `stretched-link` havola.
import Crest from '../Crest.jsx'
import Flag from '../Flag.jsx'
import { matchStatusText } from '../MatchRow.jsx'
import { Link } from '../../lib/nav.jsx'
import { dash, ratingStyle, ratingText, shortDate } from './display.js'
import Unavailable from './Unavailable.jsx'

const RESULT_TEXT = { G: "G'", D: 'D', M: 'M' }

function ScoreCells({ m, played }) {
  return played ? (
    <>
      <b>{m.hs}</b>
      <b>{m.as}</b>
    </>
  ) : (
    <>
      <i>–</i>
      <i>–</i>
    </>
  )
}

function TeamCell({ team }) {
  return (
    <span className="plm-team">
      <Crest name={team.n} c={team.c} id={team.id} size="sm" /> {dash(team.n)}
    </span>
  )
}

export function RecentRow({ m, result, rating }) {
  const played = m.hs != null && m.as != null
  const hasLink = m.id != null
  const label = `${dash(m.home.n)} ${played ? `${m.hs} : ${m.as}` : '—'} ${dash(m.away.n)}, o'yin sahifasi`
  const cells = <ScoreCells m={m} played={played} />
  return (
    <li className={`plm-row${hasLink ? ' is-linkrow' : ''}`} title={m.league?.name || undefined}>
      <span className="plm-comp">
        <Flag value={m.league?.flag} label={m.league?.name} />
      </span>
      <span className="plm-date">
        {shortDate(m.date)}
        <i>{matchStatusText(m)}</i>
      </span>
      <span className="plm-teams">
        <TeamCell team={m.home} />
        <TeamCell team={m.away} />
      </span>
      {hasLink ? (
        <Link to={`/match/${encodeURIComponent(m.id)}`} className="plm-score stretched-link" aria-label={label}>
          {cells}
        </Link>
      ) : (
        <span className="plm-score">{cells}</span>
      )}
      <span className={`plm-res is-${result || 'x'}`}>{result ? (RESULT_TEXT[result] ?? result) : null}</span>
      <span className="plm-rating" style={ratingStyle(rating)}>
        {ratingText(rating)}
      </span>
    </li>
  )
}

/**
 * @param {{ recent?: { m: object, result?: string, rating?: string|number }[], unavailable?: boolean }} props
 */
export default function MatchesTab({ recent, unavailable = false }) {
  if (unavailable) return <Unavailable>So'nggi o'yinlar yuklanmadi — manba javob bermadi.</Unavailable>
  const list = Array.isArray(recent) ? recent.filter(r => r?.m?.home && r.m.away) : []
  if (!list.length) return <p className="mp-empty">O'yinlar topilmadi.</p>
  return (
    <ul className="plm">
      {list.map((r, i) => (
        <RecentRow key={r.m.id ?? `${r.m.date}-${i}`} {...r} />
      ))}
    </ul>
  )
}
