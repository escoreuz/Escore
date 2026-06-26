import { api, useApi } from '../api.js'
import { Loading, ErrorBox } from './States.jsx'

function navigate(hash) {
  window.location.hash = hash
  window.scrollTo(0, 0)
}

export default function Rankings({ kind }) {
  const { data, loading, error } = useApi(() => api.rankings(kind), [kind])
  if (loading) return <Loading />
  if (error) return <ErrorBox message={error} />

  const rows = data?.rows || []
  const isUefa = kind === 'uefa'
  const title = isUefa ? 'UEFA reytingi' : 'FIFA reytingi'
  const sub = isUefa
    ? 'Yevropa assotsiatsiyalari koeffitsiyenti.'
    : 'Jahon terma jamoalari reytingi.'

  return (
    <section className="nw rk">
      <a href="#/score" onClick={(e) => { e.preventDefault(); navigate('/score') }} className="article__back">
        ← Score
      </a>
      <header className="nw-head">
        <p className="kicker">REYTING</p>
        <h1 className="score__title">{title}</h1>
        <p className="score__standfirst">{sub}</p>
      </header>

      <table className="rk-table">
        <thead>
          <tr><th>#</th><th className="rk-name">Jamoa</th><th>Ochko</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.rank} className={r.rank <= 3 ? 'rk-top' : ''}>
              <td className="rk-pos">{r.rank}</td>
              <td className="rk-name">
                {r.teamId
                  ? <a href={`#/team/${r.teamId}`} onClick={(e) => { e.preventDefault(); navigate(`/team/${r.teamId}`) }}>{r.name}</a>
                  : r.name}
              </td>
              <td className="rk-pts">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
