// Bitta davlat (kengayadi → ligalari). Xato keshlanmaydi: qayta urinish mumkin.
import { useEffect, useRef, useState } from 'react'
import { api, isAbortError } from '../../api.js'
import { Link } from '../../lib/nav.jsx'
import { togglePin } from '../../pins.js'
import { BoxStatus } from './SideBoxes.jsx'

const IDLE = Object.freeze({ leagues: null, error: null, loading: false })

function useCountryLeagues(countryId) {
  const [state, setState] = useState(IDLE)
  const ctrlRef = useRef(null)

  useEffect(() => () => ctrlRef.current?.abort(), [])

  const load = async () => {
    ctrlRef.current?.abort()
    const controller = new AbortController()
    ctrlRef.current = controller
    setState({ leagues: null, error: null, loading: true })
    try {
      const r = await api.countryLeagues(countryId, { signal: controller.signal })
      if (!controller.signal.aborted)
        setState({ leagues: Array.isArray(r?.leagues) ? r.leagues : [], error: null, loading: false })
    } catch (err) {
      if (controller.signal.aborted || isAbortError(err)) return
      setState({ leagues: null, error: err, loading: false })
    }
  }
  return { ...state, load }
}

function LeagueItem({ league, pinned }) {
  return (
    <li className="sc-pinrow">
      <Link className="sc-clg" to={`/league/${encodeURIComponent(league.id)}`}>
        {league.name}
      </Link>
      <button
        type="button"
        className={`sc-pin${pinned ? ' is-on' : ''}`}
        aria-pressed={pinned}
        aria-label={`${league.name} ligasini mahkamlash`}
        onClick={() => togglePin(league)}
      >
        <span aria-hidden="true">📌</span>
      </button>
    </li>
  )
}

/** @param {{ country: { id: string|number, name: string }, pinnedIds: Set<string> }} props */
export default function CountryRow({ country, pinnedIds }) {
  const [open, setOpen] = useState(false)
  const { leagues, error, loading, load } = useCountryLeagues(country.id)
  const listId = `sc-country-${country.id}`

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && leagues === null && !loading) load()
  }

  return (
    <li className="sc-country">
      <button
        type="button"
        className={`sc-country__head${open ? ' is-open' : ''}`}
        aria-expanded={open}
        aria-controls={listId}
        onClick={toggle}
      >
        <span className="sc-country__name">{country.name}</span>
        <span className="sc-country__arrow" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>
      <div id={listId} hidden={!open}>
        <BoxStatus loading={loading} error={error} onRetry={load} />
        {leagues && (
          <ul className="sc-country__leagues">
            {leagues.length === 0 ? (
              <li className="sc-favnote">Liga topilmadi.</li>
            ) : (
              leagues.map(l => <LeagueItem key={l.id} league={l} pinned={pinnedIds.has(String(l.id))} />)
            )}
          </ul>
        )}
      </div>
    </li>
  )
}
