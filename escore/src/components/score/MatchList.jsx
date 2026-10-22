// Liga bo'yicha guruhlangan o'yinlar ro'yxati + holat qatori (yangilanish vaqti, xato, partial).
import { useMemo } from 'react'
import Flag from '../Flag.jsx'
import { ErrorBox, Loading, errorText } from '../States.jsx'
import { Link } from '../../lib/nav.jsx'
import { fmtTime } from '../../settings.js'
import { groupByLeague } from './matchText.js'
import ScoreRow from './ScoreRow.jsx'

const MS_PER_SECOND = 1000

function LeagueHead({ group }) {
  const { league, leagueId, list } = group
  const name = [league.country, league.name].filter(Boolean).join(' · ') || '—'
  const linkable = leagueId != null
  return (
    <header className={`sc-block__head${linkable ? ' is-linkrow' : ''}`}>
      <span className="sc-block__flag">
        <Flag value={league.flag} label={league.country} />
      </span>
      {linkable ? (
        <Link to={`/league/${encodeURIComponent(leagueId)}`} className="sc-block__name stretched-link">
          {name}
        </Link>
      ) : (
        <span className="sc-block__name">{name}</span>
      )}
      <span className="sc-block__count">{list.length} o'yin</span>
    </header>
  )
}

function StatusLine({ updatedAt, partial, error, onRetry }) {
  const time = updatedAt ? fmtTime(Math.floor(updatedAt / MS_PER_SECOND)) : null
  return (
    <>
      {(time || partial) && (
        <p className="sc-status">
          {time && <span>Oxirgi yangilanish {time}</span>}
          {partial && <span>Faqat jonli o'yinlar ko'rsatilmoqda — manba qisman javob berdi.</span>}
        </p>
      )}
      {error && (
        <p className="sc-status is-error" role="alert">
          <span>Yangilab bo'lmadi: {errorText(error)}</span>
          <button type="button" className="state__retry" onClick={onRetry}>
            Qayta urinish
          </button>
        </p>
      )}
    </>
  )
}

/**
 * @param {{ state: ReturnType<typeof import('./useMatches.js').useMatches>, favs: Set<any>,
 *   onFav: (id: any) => void }} props
 */
export default function MatchList({ state, favs, onFav }) {
  const { matches, hasData, error, loading, updatedAt, partial, reload } = state
  const groups = useMemo(() => groupByLeague(matches), [matches])

  if (error && !hasData) return <ErrorBox error={error} onRetry={reload} title="O'yinlarni yuklab bo'lmadi" />
  if (loading) return <Loading label="O'yinlar yuklanmoqda…" />
  return (
    <>
      <StatusLine updatedAt={updatedAt} partial={partial} error={error} onRetry={reload} />
      {groups.length === 0 ? (
        <p className="sc-empty">Bu sana/filtr bo'yicha o'yinlar topilmadi.</p>
      ) : (
        groups.map(group => (
          <section key={group.key} className="sc-block">
            <LeagueHead group={group} />
            {group.list.map(m => (
              <ScoreRow key={m.id} match={m} isFav={favs.has(m.id)} onFav={onFav} />
            ))}
          </section>
        ))
      )}
    </>
  )
}
