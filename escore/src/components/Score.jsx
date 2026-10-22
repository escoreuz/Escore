// Score markazi: sana tasmasi, holat filtri, qidiruv, jonli yangilanadigan o'yinlar ro'yxati.
import { useCallback, useMemo, useState } from 'react'
import { api, useApi } from '../api.js'
import { useDebounce } from '../lib/hooks.js'
import { useSeo } from '../lib/seo.js'
import { tashkentDateKey } from '../lib/format.js'
import { errorText } from './States.jsx'
import ScoreSidebar from './ScoreSidebar.jsx'
import DayStrip from './score/DayStrip.jsx'
import Toolbar from './score/Toolbar.jsx'
import MatchList from './score/MatchList.jsx'
import { FeaturedBox, MiniStandings, ScorersBox } from './score/SideBoxes.jsx'
import { useMatches } from './score/useMatches.js'
import { pickFeatured } from './score/matchText.js'

export const SEARCH_DEBOUNCE_MS = 300
const NO_DAYS = Object.freeze([])

function useFavorites() {
  const [favs, setFavs] = useState(() => new Set())
  const toggleFav = useCallback(id => {
    setFavs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])
  return { favs, toggleFav }
}

function DaysError({ error, onRetry }) {
  return (
    <p className="sc-status is-error" role="alert">
      <span>Sanalar ro'yxatini yuklab bo'lmadi: {errorText(error)}</span>
      <button type="button" className="state__retry" onClick={onRetry}>
        Qayta urinish
      </button>
    </p>
  )
}

export default function Score() {
  useSeo({
    title: 'Jonli natijalar',
    description: "Barcha ligalardan jonli hisoblar, o'yinlar dasturi va natijalar.",
    path: '/score',
  })
  const days = useApi(o => api.days(o), [])
  // O'yinlar darhol Toshkent bo'yicha bugungi sana bilan yuklanadi; server `today` kelganda unga moslashadi
  const [clientToday] = useState(() => tashkentDateKey())
  const today = days.data?.today ?? clientToday
  const [picked, setPicked] = useState(null)
  const [status, setStatus] = useState('all')
  const [query, setQuery] = useState('')
  const q = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS)
  const { favs, toggleFav } = useFavorites()
  const date = picked ?? today
  const matchesState = useMatches({ date, status, q, isToday: date === today })
  const featured = useMemo(() => pickFeatured(matchesState.matches), [matchesState.matches])

  return (
    <section className="score">
      <header className="score__head">
        <p className="kicker">JONLI HISOB · SCORE MARKAZI</p>
        <h1 className="score__title">Score — Jonli natijalar</h1>
        <p className="score__standfirst">Barcha ligalardan jonli hisoblar, dasturlar va natijalar — bir joyda.</p>
      </header>
      {days.error && <DaysError error={days.error} onRetry={days.reload} />}
      <DayStrip days={days.data?.days ?? NO_DAYS} today={today} selected={date} onPick={setPicked} />
      <Toolbar
        status={status}
        onStatus={setStatus}
        liveCount={matchesState.liveCount}
        query={query}
        onQuery={setQuery}
      />
      <div className="sc-grid">
        <aside className="sc-left" aria-label="Ligalar va reytinglar">
          <ScoreSidebar />
        </aside>
        <div className="sc-center">
          <MatchList state={matchesState} favs={favs} onFav={toggleFav} />
        </div>
        <aside className="sc-right" aria-label="Qo'shimcha ma'lumot">
          <FeaturedBox match={featured} />
          <ScorersBox />
          <MiniStandings />
        </aside>
      </div>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {matchesState.announcement}
      </div>
    </section>
  )
}
