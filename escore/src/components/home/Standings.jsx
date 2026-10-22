// Mini turnir jadvali (yon panel). Top-4 zona rang bilan birga matnda ham bildiriladi.
import SideBox from './SideBox.jsx'

const CL_ZONE_SIZE = 4
const COLUMNS = [
  { key: 'p', short: "O'", full: "O'yinlar" },
  { key: 'w', short: "G'", full: "G'alabalar" },
  { key: 'd', short: 'D', full: 'Duranglar' },
  { key: 'l', short: 'M', full: "Mag'lubiyatlar" },
]

function HeadCell({ short, full }) {
  return (
    <th scope="col">
      <span aria-hidden="true">{short}</span>
      <span className="sr-only">{full}</span>
    </th>
  )
}

// Server null yuborishi mumkin (API-NOTES): "null" ko'rinmasin
const cell = v => (v === null || v === undefined || v === '' ? '—' : v)

function Row({ r }) {
  const top = Number.isFinite(r.pos) && r.pos <= CL_ZONE_SIZE
  return (
    <tr className={top ? 'is-top' : undefined}>
      <td className="standings__pos">{cell(r.pos)}</td>
      <td className="standings__club">
        {cell(r.club)}
        {top && <span className="sr-only">, Chempionlar Ligasi zonasi</span>}
      </td>
      {COLUMNS.map(c => (
        <td key={c.key}>{cell(r[c.key])}</td>
      ))}
      <td className="standings__pts">{cell(r.pts)}</td>
    </tr>
  )
}

export default function Standings({ rows, unavailable }) {
  const list = Array.isArray(rows) ? rows : []
  return (
    <SideBox title="TURNIR JADVALI" unavailable={unavailable} empty={list.length === 0}>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Turnir jadvali">
        <table className="standings">
          <caption className="sr-only">Turnir jadvali: o'rin, klub, o'yinlar, natijalar va ochkolar</caption>
          <thead>
            <tr>
              <HeadCell short="#" full="O'rin" />
              <th scope="col">Klub</th>
              {COLUMNS.map(c => (
                <HeadCell key={c.key} short={c.short} full={c.full} />
              ))}
              <HeadCell short="O" full="Ochkolar" />
            </tr>
          </thead>
          <tbody>
            {list.map((r, i) => (
              <Row key={`${r.pos ?? ''}-${r.club ?? ''}-${i}`} r={r} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="box__foot">Yashil — Chempionlar Ligasi zonasi</p>
    </SideBox>
  )
}
