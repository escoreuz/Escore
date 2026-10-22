// O'yinchi sahifasi: sarlavha (PersonHero) + sharh paneli + tablar (o'yinlar / mavsum / karera / yangiliklar).
// Tab tarkiblari `player/` modullarida.
import { useState } from 'react'
import { api, useApi } from '../api.js'
import { Link } from '../lib/nav.jsx'
import { useSeo } from '../lib/seo.js'
import AdSlot from './AdSlot.jsx'
import PersonHero from './PersonHero.jsx'
import { ErrorBox, Loading } from './States.jsx'
import { TabPanel, Tabs } from './Tabs.jsx'
import CareerTab from './player/CareerTab.jsx'
import { isUnavailable } from './player/display.js'
import MatchesTab from './player/MatchesTab.jsx'
import NewsTab from './player/NewsTab.jsx'
import Overview from './player/Overview.jsx'
import SeasonTab from './player/SeasonTab.jsx'

const TABS = [
  { id: 'oyin', label: "O'yinlar" },
  { id: 'mavsum', label: 'Mavsum' },
  { id: 'karera', label: 'Karera' },
  { id: 'yangi', label: 'Yangiliklar' },
]
const ID_BASE = 'pl'
const NOT_FOUND = { code: 'NOT_FOUND' }
const known = v => v != null && v !== '' && v !== '—'

/** Sarlavhadagi qisqa ma'lumotlar; noma'lum qiymatlar ko'rsatilmaydi (uydirma yo'q). */
function metaItems(p) {
  const b = p.base || {}
  return [
    ['country', b.flag, known(b.country) ? b.country : null],
    ['birth', '🎂', known(b.birth) ? `${b.birth}${known(b.age) ? ` (${b.age})` : ''}` : null],
    ['pos', '🎯', known(p.posLabel) ? p.posLabel : null],
    ['height', '📏', known(b.height) ? `${b.height} sm` : null],
    ['foot', '🦶', known(b.foot) ? b.foot : null],
    ['number', '👕', known(b.number) ? `№${b.number}` : null],
    ['value', '💶', known(p.valueText) ? p.valueText : null],
  ].filter(([, , text]) => text != null)
}

function PlayerMeta({ p }) {
  const items = metaItems(p)
  if (!items.length) return null
  return (
    <ul className="pl-meta">
      {items.map(([key, icon, text]) => (
        <li key={key}>
          {icon && <span aria-hidden="true">{icon}</span>} {text}
        </li>
      ))}
    </ul>
  )
}

function PlayerTabs({ p }) {
  const [tab, setTab] = useState(TABS[0].id)
  const [seasonSel, setSeasonSel] = useState(0)
  const panel = (id, children) => (
    <TabPanel idBase={ID_BASE} id={id} value={tab}>
      {children}
    </TabPanel>
  )
  return (
    <div className="pl-tabsarea">
      <Tabs tabs={TABS} value={tab} onChange={setTab} idBase={ID_BASE} label="O'yinchi bo'limlari" />
      <div className="pl-content">
        {panel('oyin', <MatchesTab recent={p.recent} unavailable={isUnavailable(p.meta, 'recent')} />)}
        {panel(
          'mavsum',
          <SeasonTab
            playerId={p.id}
            seasons={p.seasonsList}
            sel={seasonSel}
            onSelect={setSeasonSel}
            unavailable={isUnavailable(p.meta, 'seasons') || isUnavailable(p.meta, 'season')}
          />,
        )}
        {panel('karera', <CareerTab playerId={p.id} />)}
        {panel('yangi', <NewsTab player={p} />)}
      </div>
    </div>
  )
}

function PlayerView({ p }) {
  const team = known(p.team) ? { name: p.team, id: p.teamId ?? null, color: p.teamColor } : null
  const aside = p.followers ? <span className="pl-hero__followers">{p.followers} obunachi</span> : null
  return (
    <section className="pl">
      <Link to="/score" className="article__back">
        ← Score
      </Link>
      <div className="pl-wrap">
        <div className="pl-main">
          <PersonHero name={p.name} color={p.teamColor} photoKind="player" photoId={p.id} team={team} aside={aside}>
            <PlayerMeta p={p} />
          </PersonHero>
          <div className="pl-grid2">
            <aside className="pl-side" aria-label="O'yinchi sharhi">
              <Overview p={p} />
            </aside>
            <PlayerTabs p={p} />
          </div>
        </div>
        <aside className="ad-rail" aria-label="Reklama">
          <AdSlot label="Reklama" />
          <AdSlot label="Reklama" />
        </aside>
      </div>
    </section>
  )
}

export default function Player({ id }) {
  const { data: p, loading, error, reload } = useApi(o => api.player(id, o), [id])
  useSeo({
    title: p?.name || "O'yinchi",
    description: p?.name
      ? `${p.name}${known(p.team) ? ` (${p.team})` : ''} — statistika, o'yinlar va karera.`
      : undefined,
    path: `/player/${encodeURIComponent(id)}`,
  })
  if (loading) return <Loading />
  if (!p || error?.code === NOT_FOUND.code) {
    const retry = error && error.code !== NOT_FOUND.code ? reload : undefined
    const title = retry ? undefined : "O'yinchi topilmadi"
    return <ErrorBox error={error ?? NOT_FOUND} onRetry={retry} title={title} level={1} />
  }
  return <PlayerView p={p} />
}
