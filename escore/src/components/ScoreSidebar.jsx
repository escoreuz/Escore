import { useState, useEffect } from 'react'
import { api, useApi } from '../api.js'
import { getPins, isPinned, togglePin, unpin } from '../pins.js'

function navigate(hash) {
  window.location.hash = hash
  window.scrollTo(0, 0)
}

const leagueLogo = (id) => api.img('tournament', id)

// Liga logosi (yuklanmasa — yashiriladi)
function LeagueLogo({ id }) {
  return (
    <img
      className="sc-league__logo"
      src={leagueLogo(id)}
      alt=""
      loading="lazy"
      onError={(e) => { e.target.style.visibility = 'hidden' }}
    />
  )
}

// ---- Mahkamlangan ligalar ----
function PinnedLeagues() {
  const [pins, setPins] = useState(getPins())
  useEffect(() => {
    const on = () => setPins([...getPins()])
    window.addEventListener('escore-pins', on)
    return () => window.removeEventListener('escore-pins', on)
  }, [])

  return (
    <div className="box">
      <h4 className="box__title">MAHKAMLANGAN LIGALAR</h4>
      <ul className="sc-leagues">
        {pins.length === 0 ? (
          <li className="sc-favnote">Davlatlar bo'limidan liga mahkamlang 📌</li>
        ) : pins.map((l) => (
          <li key={l.id} className="sc-pinrow">
            <button className="sc-league" onClick={() => navigate(`/league/${l.id}`)} title="Liga sahifasi">
              <LeagueLogo id={l.id} />
              <span className="sc-league__name">{l.name}</span>
            </button>
            <button className="sc-pin is-on" title="Olib tashlash" onClick={() => unpin(l.id)}>📌</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---- Reytinglar ----
function Rankings() {
  return (
    <div className="box">
      <h4 className="box__title">REYTINGLAR</h4>
      <ul className="sc-leagues">
        <li>
          <button className="sc-league" onClick={() => navigate('/rankings/fifa')}>
            <span className="sc-rank-ic">🌐</span>
            <span className="sc-league__name">FIFA reytingi</span>
            <span className="sc-league__arrow">›</span>
          </button>
        </li>
        <li>
          <button className="sc-league" onClick={() => navigate('/rankings/uefa')}>
            <span className="sc-rank-ic">⭐</span>
            <span className="sc-league__name">UEFA reytingi</span>
            <span className="sc-league__arrow">›</span>
          </button>
        </li>
      </ul>
    </div>
  )
}

// ---- Bitta davlat (kengayadi → ligalari) ----
function CountryRow({ country }) {
  const [open, setOpen] = useState(false)
  const [leagues, setLeagues] = useState(null)
  const [loading, setLoading] = useState(false)
  const [, force] = useState(0)

  useEffect(() => {
    const on = () => force((x) => x + 1) // pin holati o'zgarsa qayta chizamiz
    window.addEventListener('escore-pins', on)
    return () => window.removeEventListener('escore-pins', on)
  }, [])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && leagues === null) {
      setLoading(true)
      api.countryLeagues(country.id)
        .then((r) => { setLeagues(r.leagues || []); setLoading(false) })
        .catch(() => { setLeagues([]); setLoading(false) })
    }
  }

  return (
    <li className="sc-country">
      <button className={`sc-country__head${open ? ' is-open' : ''}`} onClick={toggle}>
        <span className="sc-country__name">{country.name}</span>
        <span className="sc-country__arrow">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <ul className="sc-country__leagues">
          {loading ? (
            <li className="sc-favnote">Yuklanmoqda…</li>
          ) : (leagues || []).length === 0 ? (
            <li className="sc-favnote">Liga topilmadi.</li>
          ) : leagues.map((l) => (
            <li key={l.id} className="sc-pinrow">
              <button className="sc-clg" onClick={() => navigate(`/league/${l.id}`)} title="Liga sahifasi">
                {l.name}
              </button>
              <button
                className={`sc-pin${isPinned(l.id) ? ' is-on' : ''}`}
                title={isPinned(l.id) ? 'Olib tashlash' : 'Mahkamlash'}
                onClick={() => togglePin(l)}
              >
                📌
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

// ---- Davlatlar ro'yxati ----
function Countries() {
  const { data, loading } = useApi(() => api.countries(), [])
  const list = data?.countries || []
  return (
    <div className="box">
      <h4 className="box__title">DAVLATLAR</h4>
      {loading ? (
        <p className="sc-favnote">Yuklanmoqda…</p>
      ) : (
        <ul className="sc-countries">
          {list.map((c) => <CountryRow key={c.id} country={c} />)}
        </ul>
      )}
    </div>
  )
}

export default function ScoreSidebar() {
  return (
    <>
      <PinnedLeagues />
      <Rankings />
      <Countries />
    </>
  )
}
