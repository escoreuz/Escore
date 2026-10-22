// "Karera" tabi: mavsumma-mavsum jadval (alohida yuklanadi). Qisman/kesilgan natija halol ko'rsatiladi.
import { api, useApi } from '../../api.js'
import { ErrorBox, Loading } from '../States.jsx'
import { dash, ratingStyle, ratingText } from './display.js'
import Unavailable from './Unavailable.jsx'

const seasonName = f => [f?.tournament, f?.year].filter(Boolean).join(' ')

export function CareerNotes({ data }) {
  const failed = Array.isArray(data?.failedSeasons) ? data.failedSeasons.map(seasonName).filter(Boolean) : []
  return (
    <>
      {data?.partial && (
        <Unavailable>
          Ba'zi mavsumlar yuklanmadi{failed.length ? `: ${failed.join(', ')}` : ''}. Jadval to'liq emas.
        </Unavailable>
      )}
      {data?.truncated && <Unavailable>Faqat so'nggi mavsumlar ko'rsatilgan.</Unavailable>}
    </>
  )
}

const rowKey = r => `${r.year}-${r.tournament}-${r.teamId ?? ''}`

function CareerTable({ rows, isGK }) {
  const [c1, c2] = isGK ? ['QO', "O'tgan"] : ['G', 'A']
  return (
    <div className="table-scroll" role="region" aria-label="Karera jadvali" tabIndex={0}>
      <table className="plc">
        <caption className="sr-only">O'yinchi karerasi: mavsumlar bo'yicha statistika</caption>
        <thead>
          <tr>
            <th scope="col">Mavsum</th>
            <th scope="col" className="plc-comp">
              Turnir
            </th>
            <th scope="col">
              <abbr title="O'yinlar">O'</abbr>
            </th>
            <th scope="col">
              <abbr title="Daqiqalar">Daq</abbr>
            </th>
            <th scope="col">{c1}</th>
            <th scope="col">{c2}</th>
            <th scope="col">Reyting</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={rowKey(r)}>
              <td className="plc-year">{dash(r.year)}</td>
              <td className="plc-comp">{dash(r.tournament)}</td>
              <td>{dash(r.mp)}</td>
              <td>{dash(r.min)}</td>
              <td>{dash(isGK ? r.cls : r.goals)}</td>
              <td>{dash(isGK ? r.gc : r.assists)}</td>
              <td>
                <span className="plc-rating" style={ratingStyle(r.rating)}>
                  {ratingText(r.rating)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function CareerTab({ playerId }) {
  const { data, loading, error, reload } = useApi(o => api.playerCareer(playerId, o), [playerId])
  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} title="Karerani yuklab bo'lmadi" />
  const rows = Array.isArray(data?.rows) ? data.rows : []
  return (
    <>
      <CareerNotes data={data} />
      {rows.length ? (
        <CareerTable rows={rows} isGK={Boolean(data.isGK)} />
      ) : (
        <p className="mp-empty">Karera ma'lumoti topilmadi.</p>
      )}
    </>
  )
}
