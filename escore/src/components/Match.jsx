import { useEffect, useRef, useState } from 'react'
import { api, isAbortError, useApi } from '../api.js'
import { Loading, ErrorBox, errorText } from './States.jsx'
import { Tabs, TabPanel } from './Tabs.jsx'
import { Link } from '../lib/nav.jsx'
import { usePolling } from '../lib/hooks.js'
import { useSeo } from '../lib/seo.js'
import { LIVE_POLL_MS } from './score/matchText.js'
import { LeagueTablePanel } from './league/StandingsTable.jsx'
import MatchHero from './match/MatchHero.jsx'
import { Lineups, Overview, Stats } from './match/MatchSections.jsx'
import { matchTitle, sportsEventJsonLd } from './match/matchModel.js'

const MINUTE_MS = 60_000
// Rejadagi o'yin boshlanishidan shuncha oldin polling boshlanadi
const SOON_BEFORE_MS = 15 * MINUTE_MS
// Boshlanish vaqti o'tib, holat hali "sched" bo'lsa ham shuncha vaqt kuzatiladi (cheksiz emas)
const STALE_AFTER_MS = 3 * 60 * MINUTE_MS

const ID_BASE = 'match'
const BASE_TABS = [
  { id: 'sharh', label: 'Sharh' },
  { id: 'stat', label: 'Statistika' },
  { id: 'tarkib', label: 'Tarkiblar' },
]
const TABLE_TAB = { id: 'jadval', label: 'Jadval' }

/**
 * Polling kerakmi: jonli o'yin yoki boshlanishi 15 daqiqa ichida (yoki yaqinda o'tgan) rejadagi o'yin.
 * @param {{ status?: string, ts?: number } | undefined} m
 * @param {number} [now]
 */
export function shouldPoll(m, now = Date.now()) {
  if (m?.status === 'live') return true
  if (m?.status !== 'sched' || !Number.isFinite(m.ts)) return false
  const untilStart = m.ts * 1000 - now
  return untilStart <= SOON_BEFORE_MS && untilStart >= -STALE_AFTER_MS
}

// setTimeout ruxsat bergan eng katta kechikish (2^31-1 ms ≈ 24,8 kun); kattarog'i darhol ishlab ketadi
const MAX_TIMEOUT_MS = 2 ** 31 - 1

/**
 * Polling oynasining keyingi chegarasi (epoch ms): oyna ochiladigan yoki yopiladigan payt; yo'q bo'lsa null.
 * @param {{ status?: string, ts?: number } | undefined} m
 * @param {number} [now]
 */
export function nextPollBoundary(m, now = Date.now()) {
  if (m?.status !== 'sched' || !Number.isFinite(m.ts)) return null
  const start = m.ts * 1000 - SOON_BEFORE_MS
  const end = m.ts * 1000 + STALE_AFTER_MS
  if (now < start) return start
  if (now <= end) return end + 1
  return null
}

/**
 * Polling oynasi chegarasida komponentni qayta render qiladi — `shouldPoll` dagi Date.now() eskirib qolmasin.
 * Kechikish [0, MAX_TIMEOUT_MS] oralig'ida; uzoq kechikishda taymer chegarada qayta rejalashtiriladi.
 */
function usePollWindowTick(m) {
  const [tick, setTick] = useState(0)
  const status = m?.status
  const ts = m?.ts
  useEffect(() => {
    const boundary = nextPollBoundary({ status, ts })
    if (boundary == null) return undefined
    const delay = Math.min(Math.max(boundary - Date.now(), 0), MAX_TIMEOUT_MS)
    const id = setTimeout(() => setTick(t => t + 1), delay)
    return () => clearTimeout(id)
  }, [status, ts, tick])
}

/**
 * Har LIVE_POLL_MS da keshsiz (`fresh: true`) yangilaydi; unmountda so'rov bekor qilinadi.
 * Polling xatosi oxirgi ma'lumotni saqlaydi va `pollError` qaytaradi; o'yin tugasa to'xtaydi.
 */
function useLiveMatch(id, initial) {
  const [latest, setLatest] = useState(null)
  const [pollError, setPollError] = useState(null)
  const ctrl = useRef(null)
  const d = latest ?? initial

  useEffect(() => () => ctrl.current?.abort(), [])
  usePollWindowTick(d?.match)

  usePolling(
    async () => {
      ctrl.current?.abort()
      const c = new AbortController()
      ctrl.current = c
      try {
        const next = await api.match(id, { fresh: true, signal: c.signal })
        setLatest(next)
        setPollError(null)
      } catch (err) {
        if (isAbortError(err)) return
        setPollError(err)
      }
    },
    LIVE_POLL_MS,
    { enabled: shouldPoll(d?.match) },
  )
  return { d, pollError }
}

function matchSeo(id, d) {
  const path = `/match/${encodeURIComponent(id)}`
  if (!d?.match) return { title: "O'yin", path }
  const title = matchTitle(d.match)
  const league = d.league?.name ? ` · ${d.league.name}` : ''
  return {
    title,
    path,
    description: `${title}${league}: hisob, o'yin voqealari, statistika va tarkiblar.`,
    jsonLd: sportsEventJsonLd(d),
  }
}

export default function Match({ id }) {
  const [tab, setTab] = useState('sharh')
  const { data, loading, error, reload } = useApi(o => api.match(id, o), [id])
  const { d, pollError } = useLiveMatch(id, data)
  useSeo(matchSeo(id, d))

  if (error && !d) return <ErrorBox error={error} onRetry={reload} level={1} />
  if (!d?.match) {
    if (loading) return <Loading />
    return <ErrorBox error={{ code: 'NOT_FOUND' }} title="O'yin topilmadi" level={1} />
  }

  const leagueId = d.league?.id ?? d.match.leagueId ?? null
  const tabs = leagueId != null ? [...BASE_TABS, TABLE_TAB] : BASE_TABS
  const highlight = [d.match.home?.id, d.match.away?.id]

  return (
    <section className="mp">
      <Link to="/score" className="article__back">
        ← Score
      </Link>
      <MatchHero d={d} />
      {pollError && (
        <p className="sc-status is-error" role="status">
          Jonli yangilab bo'lmadi: {errorText(pollError)}
        </p>
      )}

      <Tabs tabs={tabs} value={tab} onChange={setTab} idBase={ID_BASE} label="O'yin bo'limlari" />
      <div className="mp-content">
        <TabPanel idBase={ID_BASE} id="sharh" value={tab}>
          <Overview d={d} />
        </TabPanel>
        <TabPanel idBase={ID_BASE} id="stat" value={tab}>
          <Stats d={d} />
        </TabPanel>
        <TabPanel idBase={ID_BASE} id="tarkib" value={tab}>
          <Lineups d={d} />
        </TabPanel>
        {leagueId != null && (
          <TabPanel idBase={ID_BASE} id="jadval" value={tab}>
            <LeagueTablePanel leagueId={leagueId} highlightIds={highlight} title={d.league?.name || 'Turnir jadvali'} />
          </TabPanel>
        )}
      </div>
    </section>
  )
}
