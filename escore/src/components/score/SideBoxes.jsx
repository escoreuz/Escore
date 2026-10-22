// O'ng panel bloklari: tanlangan o'yin, bombardirlar, mini-jadval; umumiy BoxStatus.
import Crest from '../Crest.jsx'
import { errorText } from '../States.jsx'
import { api, useApi } from '../../api.js'
import { Link } from '../../lib/nav.jsx'
import { hasScore, scoreText, statusWord, teamName } from './matchText.js'

const NO_VALUE = '—'
const show = v => (v == null || v === '' ? NO_VALUE : v)

/** Kichik blok ichidagi yuklanish/xato holati. Ma'lumot bor bo'lsa null. */
export function BoxStatus({ loading, error, onRetry }) {
  if (error)
    return (
      <p className="sc-status is-error" role="alert">
        <span>{errorText(error)}</span>
        {onRetry && (
          <button type="button" className="state__retry" onClick={onRetry}>
            Qayta urinish
          </button>
        )}
      </p>
    )
  if (loading) return <p className="sc-favnote">Yuklanmoqda…</p>
  return null
}

function FeaturedTeam({ team }) {
  return (
    <div className="sc-featured__team">
      <Crest name={teamName(team)} c={team?.c} id={team?.id} kind="team" />
      <span>{teamName(team)}</span>
    </div>
  )
}

/** Tanlangan (birinchi jonli) o'yin; jonli o'yin bo'lmasa blok chiqmaydi. */
export function FeaturedBox({ match: m }) {
  if (!m) return null
  const leagueName = [m.league?.country, m.league?.name].filter(Boolean).join(' · ')
  return (
    <section className="box">
      <h2 className="box__title">TANLANGAN O'YIN</h2>
      <div className={`sc-featured${m.id != null ? ' is-linkrow' : ''}`}>
        <span className="sc-featured__league">{[leagueName, statusWord(m)].filter(Boolean).join(' · ')}</span>
        <div className="sc-featured__row">
          <FeaturedTeam team={m.home} />
          <div className="sc-featured__score">
            <span className="sr-only">{scoreText(m)}</span>
            <strong aria-hidden="true">{hasScore(m) ? `${m.hs} – ${m.as}` : '– –'}</strong>
            {Number.isFinite(m.minute) && <span className="sc-min sc-min--live">{m.minute}'</span>}
          </div>
          <FeaturedTeam team={m.away} />
        </div>
        {m.id != null && (
          <Link
            to={`/match/${encodeURIComponent(m.id)}`}
            className="stretched-link"
            aria-label={`O'yin sahifasi: ${scoreText(m)}`}
          />
        )}
      </div>
    </section>
  )
}

function ScorerItem({ p }) {
  const linkable = p.id != null
  return (
    <li className={`sc-scorer${linkable ? ' is-linkrow' : ''}`}>
      <span className="sc-scorer__rank">{show(p.rank)}</span>
      <Crest name={p.team ?? p.name} c={p.c} id={p.id} kind="player" size="sm" />
      {linkable ? (
        <Link to={`/player/${encodeURIComponent(p.id)}`} className="sc-scorer__name stretched-link">
          {show(p.name)}
        </Link>
      ) : (
        <span className="sc-scorer__name">{show(p.name)}</span>
      )}
      <span className="sc-scorer__goals">
        <span className="sr-only">Gollar: </span>
        {show(p.goals)}
      </span>
    </li>
  )
}

export function ScorersBox() {
  const { data, error, loading, reload } = useApi(o => api.scorers(o), [])
  const list = Array.isArray(data) ? data : []
  return (
    <section className="box">
      <h2 className="box__title">BOMBARDIRLAR</h2>
      <BoxStatus loading={loading} error={error} onRetry={reload} />
      {!loading && !error && list.length === 0 && <p className="sc-favnote">Ma'lumot yo'q.</p>}
      <ul className="sc-scorers">
        {list.map((p, i) => (
          <ScorerItem key={p.id ?? `${p.rank}-${p.name}-${i}`} p={p} />
        ))}
      </ul>
    </section>
  )
}

export function MiniStandings() {
  const { data, error, loading, reload } = useApi(o => api.standingsMini(o), [])
  const list = Array.isArray(data) ? data : []
  return (
    <section className="box">
      <h2 className="box__title">JADVAL (TOP-5)</h2>
      <BoxStatus loading={loading} error={error} onRetry={reload} />
      {!loading && !error && list.length === 0 && <p className="sc-favnote">Ma'lumot yo'q.</p>}
      <ul className="sc-ministand">
        {list.map((r, i) => (
          <li key={`${r.pos}-${r.club}-${i}`}>
            <span className="sc-ministand__pos">{show(r.pos)}</span>
            <span className="sc-ministand__club">{show(r.club)}</span>
            <span className="sc-ministand__pts">
              <span className="sr-only">Ochko: </span>
              {show(r.pts)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
