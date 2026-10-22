// Score chap paneli: mahkamlangan ligalar, reytinglar, davlatlar → ligalar.
import { memo, useMemo } from 'react'
import { api, useApi } from '../api.js'
import { Link } from '../lib/nav.jsx'
import { unpin, usePins } from '../pins.js'
import CountryRow from './score/CountryRow.jsx'
import { BoxStatus } from './score/SideBoxes.jsx'

// Liga logosi (yuklanmasa — yashiriladi)
function LeagueLogo({ id }) {
  const src = api.img('tournament', id)
  if (!src) return null
  return (
    <img
      className="sc-league__logo"
      src={src}
      alt=""
      loading="lazy"
      onError={e => {
        e.currentTarget.style.visibility = 'hidden'
      }}
    />
  )
}

function PinnedLeagues() {
  const pins = usePins()
  return (
    <div className="box">
      <h2 className="box__title">MAHKAMLANGAN LIGALAR</h2>
      <ul className="sc-leagues">
        {pins.length === 0 ? (
          <li className="sc-favnote">Davlatlar bo'limidan liga mahkamlang</li>
        ) : (
          pins.map(l => (
            <li key={l.id} className="sc-pinrow">
              <Link className="sc-league" to={`/league/${encodeURIComponent(l.id)}`}>
                <LeagueLogo id={l.id} />
                <span className="sc-league__name">{l.name}</span>
              </Link>
              <button
                type="button"
                className="sc-pin is-on"
                aria-label={`${l.name}: mahkamlashni olib tashlash`}
                onClick={() => unpin(l.id)}
              >
                <span aria-hidden="true">📌</span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

const RANKINGS = [
  { kind: 'fifa', icon: '🌐', label: 'FIFA reytingi' },
  { kind: 'uefa', icon: '⭐', label: 'UEFA reytingi' },
]

function Rankings() {
  return (
    <div className="box">
      <h2 className="box__title">REYTINGLAR</h2>
      <ul className="sc-leagues">
        {RANKINGS.map(r => (
          <li key={r.kind}>
            <Link className="sc-league" to={`/rankings/${r.kind}`}>
              <span className="sc-rank-ic" aria-hidden="true">
                {r.icon}
              </span>
              <span className="sc-league__name">{r.label}</span>
              <span className="sc-league__arrow" aria-hidden="true">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Countries() {
  const { data, error, loading, reload } = useApi(o => api.countries(o), [])
  const list = Array.isArray(data?.countries) ? data.countries : []
  const pins = usePins()
  const pinnedIds = useMemo(() => new Set(pins.map(p => String(p.id))), [pins])
  return (
    <div className="box">
      <h2 className="box__title">DAVLATLAR</h2>
      <BoxStatus loading={loading} error={error} onRetry={reload} />
      {!loading && !error && (
        <ul className="sc-countries">
          {list.map(c => (
            <CountryRow key={c.id} country={c} pinnedIds={pinnedIds} />
          ))}
        </ul>
      )}
    </div>
  )
}

// Score har polling'da qayta chiziladi — panelning o'z ma'lumoti bor, props yo'q
function ScoreSidebar() {
  return (
    <>
      <PinnedLeagues />
      <Rankings />
      <Countries />
    </>
  )
}

export default memo(ScoreSidebar)
