// UEFA / FIFA reyting sahifasi. Noma'lum `kind` → 404 sahifa (serverga so'rov yuborilmaydi).
import { api, useApi } from '../api.js'
import { Link } from '../lib/nav.jsx'
import { useSeo } from '../lib/seo.js'
import NotFound from './NotFound.jsx'
import { Empty, ErrorBox, Loading } from './States.jsx'
import { dash } from './player/display.js'

const KINDS = {
  uefa: { title: 'UEFA reytingi', sub: 'Yevropa assotsiatsiyalari koeffitsiyenti.' },
  fifa: { title: 'FIFA reytingi', sub: 'Jahon terma jamoalari reytingi.' },
}
const TOP_COUNT = 3

export const isKnownKind = kind => typeof kind === 'string' && Object.hasOwn(KINDS, kind)

function RankingsTable({ rows, title }) {
  return (
    <div className="table-scroll" role="region" aria-label={title} tabIndex={0}>
      <table className="rk-table">
        <caption className="sr-only">{title}: o'rin, jamoa va ochko</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col" className="rk-name">
              Jamoa
            </th>
            <th scope="col">Ochko</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={`${r.rank ?? ''}-${r.teamId ?? r.name}-${i}`}
              className={r.rank != null && r.rank <= TOP_COUNT ? 'rk-top' : undefined}
            >
              <td className="rk-pos">{dash(r.rank)}</td>
              <td className="rk-name">
                {r.teamId != null ? (
                  <Link to={`/team/${encodeURIComponent(r.teamId)}`}>{dash(r.name)}</Link>
                ) : (
                  dash(r.name)
                )}
              </td>
              <td className="rk-pts">{dash(r.points)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RankingsBody({ state, title }) {
  const { data, loading, error, reload } = state
  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} title="Reytingni yuklab bo'lmadi" />
  const rows = Array.isArray(data?.rows) ? data.rows.filter(Boolean) : []
  if (!rows.length) return <Empty>Reyting ma'lumoti hozircha yo'q.</Empty>
  return <RankingsTable rows={rows} title={title} />
}

function RankingsPage({ kind }) {
  const { title, sub } = KINDS[kind]
  const state = useApi(o => api.rankings(kind, o), [kind])
  useSeo({ title, description: `${title} — ${sub}`, path: `/rankings/${kind}` })
  return (
    <section className="nw rk">
      <Link to="/score" className="article__back">
        ← Score
      </Link>
      <header className="nw-head">
        <p className="kicker">REYTING</p>
        <h1 className="score__title">{title}</h1>
        <p className="score__standfirst">{sub}</p>
      </header>
      <RankingsBody state={state} title={title} />
    </section>
  )
}

export default function Rankings({ kind }) {
  return isKnownKind(kind) ? <RankingsPage kind={kind} /> : <NotFound />
}
