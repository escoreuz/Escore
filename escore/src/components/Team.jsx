import { useState } from 'react'
import { api, useApi } from '../api.js'
import { Loading, ErrorBox } from './States.jsx'
import Crest from './Crest.jsx'
import { Tabs, TabPanel } from './Tabs.jsx'
import { Link } from '../lib/nav.jsx'
import { useSeo } from '../lib/seo.js'
import { LeagueTablePanel } from './league/StandingsTable.jsx'
import { Squad, TeamMatches, TeamOverview } from './team/TeamSections.jsx'
import { isKnown } from './league/shared.js'

const ID_BASE = 'team'
const BASE_TABS = [
  { id: 'sharh', label: 'Sharh' },
  { id: 'sostav', label: 'Tarkib' },
  { id: 'oyinlar', label: "O'yinlar" },
]
const TABLE_TAB = { id: 'jadval', label: 'Jadval' }

function teamSeo(id, t) {
  const path = `/team/${encodeURIComponent(id)}`
  if (!t?.name) return { title: 'Jamoa', path }
  return { title: t.name, path, description: `${t.name}: tarkib, o'yinlar, forma va turnir jadvali.` }
}

function TeamHero({ t }) {
  const leagueName = t.league?.name || 'Turnir'
  const sub = [t.info?.stadium, t.info?.city].filter(isKnown).join(' · ')
  return (
    <header className="tm-hero">
      <Crest name={t.name ?? ''} c={t.color} id={t.id ?? undefined} kind="team" size="lg" />
      <div>
        <p className="kicker">
          {t.league?.flag && <span aria-hidden="true">{t.league.flag} </span>}
          {t.leagueId != null ? (
            <Link to={`/league/${encodeURIComponent(t.leagueId)}`} className="tm-hero__league">
              {leagueName}
            </Link>
          ) : (
            leagueName
          )}
        </p>
        <h1 className="tm-hero__name">{t.name || '—'}</h1>
        {sub && <p className="tm-hero__sub">{sub}</p>}
      </div>
    </header>
  )
}

export default function Team({ id }) {
  const [tab, setTab] = useState('sharh')
  const { data: t, loading, error, reload } = useApi(o => api.team(id, o), [id])
  useSeo(teamSeo(id, t))

  if (error) {
    const notFound = error.code === 'NOT_FOUND'
    return (
      <ErrorBox
        error={error}
        onRetry={notFound ? undefined : reload}
        title={notFound ? 'Jamoa topilmadi' : undefined}
        level={1}
      />
    )
  }
  if (!t) return loading ? <Loading /> : <ErrorBox error={{ code: 'NOT_FOUND' }} onRetry={reload} level={1} />

  const tabs = t.leagueId != null ? [...BASE_TABS, TABLE_TAB] : BASE_TABS
  return (
    <section className="tm">
      <Link to="/score" className="article__back">
        ← Score
      </Link>
      <TeamHero t={t} />

      <Tabs tabs={tabs} value={tab} onChange={setTab} idBase={ID_BASE} label="Jamoa bo'limlari" />
      <div className="tm-content">
        <TabPanel idBase={ID_BASE} id="sharh" value={tab}>
          <TeamOverview t={t} />
        </TabPanel>
        <TabPanel idBase={ID_BASE} id="sostav" value={tab}>
          <Squad t={t} />
        </TabPanel>
        <TabPanel idBase={ID_BASE} id="oyinlar" value={tab}>
          <TeamMatches t={t} />
        </TabPanel>
        {t.leagueId != null && (
          <TabPanel idBase={ID_BASE} id="jadval" value={tab}>
            <LeagueTablePanel leagueId={t.leagueId} highlightIds={[t.id]} title={t.league?.name || 'Turnir jadvali'} />
          </TabPanel>
        )}
      </div>
    </section>
  )
}
