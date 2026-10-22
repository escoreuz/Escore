// "So'nggi daqiqa" yuguruvchi lentasi. Pauza tugmasi bor; animatsiya uchun ikkinchi nusxa aria-hidden.
import { useState } from 'react'

export default function Ticker({ items }) {
  const [paused, setPaused] = useState(false)
  const list = Array.isArray(items) ? items.filter(Boolean) : []
  if (list.length === 0) return null
  return (
    <div className={`ticker${paused ? ' is-paused' : ''}`} role="region" aria-label="So'nggi daqiqa xabarlari">
      <span className="ticker__label">SO'NGGI DAQIQA</span>
      <div className="ticker__viewport">
        <div className="ticker__track">
          {list.map((t, i) => (
            <span key={`a-${i}`} className="ticker__item">
              <span aria-hidden="true">⚽ </span>
              {t}
            </span>
          ))}
          {list.map((t, i) => (
            <span key={`b-${i}`} className="ticker__item" aria-hidden="true">
              ⚽ {t}
            </span>
          ))}
        </div>
      </div>
      <button type="button" className="ticker__pause" aria-pressed={paused} onClick={() => setPaused(p => !p)}>
        <span aria-hidden="true">{paused ? '▶' : '❚❚'}</span>
        <span className="sr-only">Lentani to'xtatish</span>
      </button>
    </div>
  )
}
