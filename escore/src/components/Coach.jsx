// Murabbiy sahifasi: sarlavha + tablar (sharh / karyera / o'yinlar).
// Server bermagan raqamlar (kubok, o'rtacha ochko, davr) null keladi → "—" (uydirma nol yo'q).
import { useState } from 'react'
import { api, useApi } from '../api.js'
import { Link } from '../lib/nav.jsx'
import { useSeo } from '../lib/seo.js'
import Crest from './Crest.jsx'
import PersonHero from './PersonHero.jsx'
import { ErrorBox, Loading } from './States.jsx'
import { TabPanel, Tabs } from './Tabs.jsx'
import { dash, isUnavailable } from './player/display.js'
import PersonMatches from './player/PersonMatches.jsx'

const TABS = [
  { id: 'sharh', label: 'Sharh' },
  { id: 'karyera', label: 'Karyera' },
  { id: 'oyin', label: "O'yinlar" },
]
const ID_BASE = 'co'
const NOT_FOUND = { code: 'NOT_FOUND' }

const pct = v => (v == null ? '—' : `${v}%`)
const withUnit = (v, unit) => (v == null ? '—' : `${v} ${unit}`)
const period = row => (row.from == null && row.to == null ? '—' : `${row.from ?? '…'}–${row.to ?? '…'}`)

function InfoTable({ c }) {
  const rows = [
    ['Joriy jamoa', dash(c.team)],
    ['Fuqarolik', c.country ? `${c.flag ?? ''} ${c.country}`.trim() : '—'],
    ['Yosh', withUnit(c.age, 'yosh')],
    ['Sevimli sxema', dash(c.formation)],
    ["Boshqargan o'yinlar", dash(c.totalGames)],
    ['Jami kuboklar', dash(c.totalTrophies)],
  ]
  return (
    <table className="tm-info">
      <caption className="sr-only">Murabbiy haqida</caption>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <th scope="row">{k}</th>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function RecordBar({ r }) {
  const parts = [
    ['is-w', "G'alaba", r.w],
    ['is-d', 'Durang', r.d],
    ['is-l', "Mag'lubiyat", r.l],
  ]
  if (!r.games || parts.some(([, , v]) => v == null)) {
    return <p className="mp-empty">Joriy mavsum natijalari mavjud emas.</p>
  }
  return (
    <div className="co-record">
      <div className="co-bar" aria-hidden="true">
        {parts.map(([cls, , v]) => (
          <span key={cls} className={`co-bar__seg ${cls}`} style={{ width: (v / r.games) * 100 + '%' }}>
            {v}
          </span>
        ))}
      </div>
      <div className="co-bar__labels">
        {parts.map(([cls, label, v]) => (
          <span key={cls}>
            {label} {v}
          </span>
        ))}
      </div>
    </div>
  )
}

function Overview({ c }) {
  const r = c.record || {}
  const kpis = [
    ["O'yinlar", dash(r.games)],
    ["O'rtacha ochko", dash(r.ppg)],
    ["G'alaba foizi", pct(r.winPct)],
  ]
  return (
    <div className="co-overview">
      <InfoTable c={c} />
      <h2 className="mp-subtitle">Joriy mavsum ko'rsatkichi</h2>
      <RecordBar r={r} />
      <div className="co-kpis">
        {kpis.map(([cap, v]) => (
          <div key={cap} className="co-kpi">
            <span className="co-kpi__num">{v}</span>
            <span className="co-kpi__cap">{cap}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ClubCell({ row }) {
  const inner = (
    <span className="lg-club__inner">
      <Crest name={row.club} c={row.c} id={row.id} />
      <span className="lg-club__name">{dash(row.club)}</span>
    </span>
  )
  if (row.id == null) return <span className="lg-club__link">{inner}</span>
  return (
    <Link to={`/team/${encodeURIComponent(row.id)}`} className="lg-club__link">
      {inner}
    </Link>
  )
}

function Career({ career }) {
  const rows = Array.isArray(career) ? career.filter(Boolean) : []
  if (!rows.length) return <p className="mp-empty">Karyera ma'lumoti topilmadi.</p>
  return (
    <div className="table-scroll" role="region" aria-label="Murabbiy karyerasi" tabIndex={0}>
      <table className="co-career">
        <caption className="sr-only">Murabbiy boshqargan klublar</caption>
        <thead>
          <tr>
            <th scope="col" className="lg-table__club">
              Klub
            </th>
            <th scope="col">Davr</th>
            <th scope="col">O'yin</th>
            <th scope="col">O'rt.ochko</th>
            <th scope="col">Kubok</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${row.id ?? row.club}-${row.from ?? ''}`} className={i === 0 ? 'co-cur' : undefined}>
              <td className="lg-table__club">
                <ClubCell row={row} />
              </td>
              <td>{period(row)}</td>
              <td>{dash(row.games)}</td>
              <td className="lg-pts">{dash(row.ppg)}</td>
              <td>{dash(row.trophies)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CoachView({ c }) {
  const [tab, setTab] = useState(TABS[0].id)
  const team = c.team && c.team !== '—' ? { name: c.team, id: c.teamId ?? null, color: c.teamColor } : null
  const kicker = <>{c.flag && <span aria-hidden="true">{c.flag} </span>}BOSH MURABBIY</>
  return (
    <section className="co">
      <Link to="/score" className="article__back">
        ← Score
      </Link>
      <PersonHero
        name={c.name}
        kicker={kicker}
        color={c.teamColor}
        photoKind="manager"
        photoId={c.id}
        team={team}
        stat={{ value: c.record?.winPct == null ? null : `${c.record.winPct}%`, cap: "G'alaba" }}
      />
      <Tabs tabs={TABS} value={tab} onChange={setTab} idBase={ID_BASE} label="Murabbiy bo'limlari" />
      <div className="pl-content">
        <TabPanel idBase={ID_BASE} id="sharh" value={tab}>
          <Overview c={c} />
        </TabPanel>
        <TabPanel idBase={ID_BASE} id="karyera" value={tab}>
          <Career career={c.career} />
        </TabPanel>
        <TabPanel idBase={ID_BASE} id="oyin" value={tab}>
          <PersonMatches
            matches={c.matches}
            unavailable={isUnavailable(c.meta, 'matches')}
            emptyText="O'yinlar topilmadi."
          />
        </TabPanel>
      </div>
    </section>
  )
}

export default function Coach({ id }) {
  const { data: c, loading, error, reload } = useApi(o => api.coach(id, o), [id])
  useSeo({
    title: c?.name || 'Murabbiy',
    description: c?.name ? `${c.name} — bosh murabbiy: karyera va so'nggi o'yinlar.` : undefined,
    path: `/coach/${encodeURIComponent(id)}`,
  })
  if (loading) return <Loading />
  if (!c || error?.code === NOT_FOUND.code) {
    const retry = error && error.code !== NOT_FOUND.code ? reload : undefined
    const title = retry ? undefined : 'Murabbiy topilmadi'
    return <ErrorBox error={error ?? NOT_FOUND} onRetry={retry} title={title} level={1} />
  }
  return <CoachView c={c} />
}
