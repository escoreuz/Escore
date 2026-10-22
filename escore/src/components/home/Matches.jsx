// Yon panel: so'nggi natijalar, bugungi o'yinlar, qisqa xabarlar
import { matchTime } from '../../settings.js'
import SideBox from './SideBox.jsx'

const listOf = v => (Array.isArray(v) ? v : [])
// Server null yuborishi mumkin (API-NOTES): "null" ko'rinmasin
const DASH = '—'
const text = v => (v === null || v === undefined || v === '' ? DASH : v)

export function Results({ items, unavailable }) {
  const list = listOf(items)
  return (
    <SideBox title="SO'NGGI NATIJALAR" unavailable={unavailable} empty={list.length === 0}>
      <ul className="results">
        {list.map((m, i) => (
          <li key={`${m.home}-${m.away}-${i}`} className="results__row">
            <span className="results__team results__team--h">{text(m.home)}</span>
            <span className="results__score">
              {text(m.hs)}
              <i aria-hidden="true">:</i>
              <span className="sr-only"> – </span>
              {text(m.as)}
            </span>
            <span className="results__team results__team--a">{text(m.away)}</span>
          </li>
        ))}
      </ul>
    </SideBox>
  )
}

export function Fixtures({ items, unavailable }) {
  const list = listOf(items)
  return (
    <SideBox title="BUGUNGI O'YINLAR" unavailable={unavailable} empty={list.length === 0}>
      <ul className="fixtures">
        {list.map((m, i) => (
          <li key={`${m.home}-${m.away}-${i}`} className="fixtures__row">
            <span className="fixtures__time">{matchTime(m) || DASH}</span>
            <span className="fixtures__match">
              {text(m.home)} — {text(m.away)}
            </span>
          </li>
        ))}
      </ul>
    </SideBox>
  )
}

export function Briefs({ items }) {
  const list = listOf(items)
  return (
    <SideBox title="QISQA XABARLAR" className="box box--briefs" empty={list.length === 0}>
      <ul className="briefs">
        {list.map((b, i) => (
          <li key={i}>
            <span className="briefs__bullet" aria-hidden="true">
              ▪
            </span>
            {b}
          </li>
        ))}
      </ul>
    </SideBox>
  )
}
