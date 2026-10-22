import { useState } from 'react'
import { api, useApi } from '../api.js'
import { Loading, ErrorBox } from './States.jsx'
import Flag from './Flag.jsx'
import { Tabs, TabPanel } from './Tabs.jsx'
import { Link } from '../lib/nav.jsx'
import { useSeo } from '../lib/seo.js'
import { LeagueMatches, LeagueScorers, LeagueStandings, SeasonPicker, StageBar } from './league/LeagueSections.jsx'
import Unavailable from './league/Unavailable.jsx'

const ID_BASE = 'league'
const TABS = [
  { id: 'jadval', label: 'Jadval' },
  { id: 'oyinlar', label: "O'yinlar" },
  { id: 'bomb', label: 'Bombardirlar' },
]

function leagueSeo(id, lg) {
  const path = `/league/${encodeURIComponent(id)}`
  if (!lg) return { title: 'Turnir', path }
  const name = lg.name || 'Turnir'
  const where = lg.country ? ` (${lg.country})` : ''
  return { title: name, path, description: `${name}${where}: turnir jadvali, o'yinlar va bombardirlar.` }
}

function LeagueHero({ data, selected }) {
  const lg = data.league
  const year = data.seasons?.find(s => selected != null && String(s.id) === String(selected))?.year
  return (
    <header className="lg-hero">
      <span className="lg-hero__flag">
        <Flag value={lg.flag} label={lg.country || undefined} />
      </span>
      <div>
        <p className="kicker">
          {lg.country || 'Turnir'}
          {year ? ` · MAVSUM ${year}` : ''}
        </p>
        <h1 className="lg-hero__name">{lg.name || 'Turnir'}</h1>
        {data.teamCount > 0 && (
          <p className="lg-hero__sub">
            {data.teamCount} ta jamoa{lg.country ? ` · ${lg.country}` : ''}
          </p>
        )}
      </div>
    </header>
  )
}

// Yangi mavsum yuklanayotganda/xatoda tab maydonida ko'rsatiladigan holat; tayyor bo'lsa null
function pendingView({ data, loading, error, reload }) {
  if (error) return <ErrorBox error={error} onRetry={reload} />
  if (data?.league) return null
  if (loading || !data) return <Loading label="Mavsum yuklanmoqda…" />
  return <ErrorBox error={{ code: 'NOT_FOUND' }} onRetry={reload} />
}

export default function League({ id }) {
  const [tab, setTab] = useState('jadval')
  // ID o'zgarsa App sahifani `key` bilan qayta yaratadi — mavsum holati qo'lda tozalanmaydi
  const [season, setSeason] = useState()
  const state = useApi(o => api.league(id, season, o), [id, season])
  // Mavsum almashganda oxirgi yuklangan sarlavha va mavsum tanlovi saqlanadi (fokus yo'qolmaydi)
  const [shown, setShown] = useState(null)
  if (state.data?.league && state.data !== shown) setShown(state.data)
  const view = state.data?.league ? state.data : shown
  useSeo(leagueSeo(id, view?.league))

  if (!view) {
    if (state.error) return <ErrorBox error={state.error} onRetry={state.reload} level={1} />
    if (state.loading || !state.data) return <Loading />
    return <ErrorBox error={{ code: 'NOT_FOUND' }} title="Turnir topilmadi" level={1} />
  }

  const pending = pendingView(state)
  const panel = node => pending ?? node
  const leagueName = view.league.name || 'Turnir'
  return (
    <section className="lg">
      <Link to="/score" className="article__back">
        ← Score
      </Link>
      <LeagueHero data={view} selected={season ?? view.currentSeasonId} />
      <SeasonPicker seasons={view.seasons} current={season ?? view.currentSeasonId} onPick={setSeason} />
      {!pending && <StageBar stages={view.stages} />}
      {!pending && <Unavailable meta={view.meta} parts={['stages']} label="Turnir bosqichlari" />}

      <Tabs tabs={TABS} value={tab} onChange={setTab} idBase={ID_BASE} label="Turnir bo'limlari" />
      <div className="lg-content">
        <TabPanel idBase={ID_BASE} id="jadval" value={tab}>
          {panel(<LeagueStandings data={view} />)}
        </TabPanel>
        <TabPanel idBase={ID_BASE} id="oyinlar" value={tab}>
          {panel(<LeagueMatches list={view.matches} meta={view.meta} />)}
        </TabPanel>
        <TabPanel idBase={ID_BASE} id="bomb" value={tab}>
          {panel(<LeagueScorers list={view.scorers} meta={view.meta} leagueName={leagueName} />)}
        </TabPanel>
      </div>
    </section>
  )
}
