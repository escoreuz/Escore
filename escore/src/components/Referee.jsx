// Hakam sahifasi: sarlavha + tablar (sharh / o'yinlar).
// Server bermagan raqamlar (penalti, turnirlar bo'yicha bo'linish) null keladi → "—".
import { useState } from 'react'
import { api, useApi } from '../api.js'
import { Link } from '../lib/nav.jsx'
import { useSeo } from '../lib/seo.js'
import PersonHero from './PersonHero.jsx'
import { ErrorBox, Loading } from './States.jsx'
import { TabPanel, Tabs } from './Tabs.jsx'
import { dash, isUnavailable } from './player/display.js'
import PersonMatches from './player/PersonMatches.jsx'

const TABS = [
  { id: 'sharh', label: 'Sharh' },
  { id: 'oyin', label: "O'yinlar" },
]
const ID_BASE = 'rf'
const NOT_FOUND = { code: 'NOT_FOUND' }

function Kpis({ t }) {
  const items = [
    ['', "O'yinlar", t.apps],
    [' rf-kpi--y', 'Sariq', t.yellow],
    [' rf-kpi--r', 'Qizil', t.red],
    ['', 'Penalti', t.pen],
  ]
  return (
    <div className="rf-kpis">
      {items.map(([mod, cap, v]) => (
        <div key={cap} className={`rf-kpi${mod}`}>
          <span className="rf-kpi__num">{dash(v)}</span>
          <span className="rf-kpi__cap">{cap}</span>
        </div>
      ))}
    </div>
  )
}

function InfoTable({ r, t }) {
  const rows = [
    ['Fuqarolik', r.country && r.country !== '—' ? `${r.flag ?? ''} ${r.country}`.trim() : '—'],
    ['Yosh', r.age == null ? '—' : `${r.age} yosh`],
    ["Jami o'yinlar", dash(t.apps)],
    ['Jami sariq kartalar', dash(t.yellow)],
    ['Jami qizil kartalar', dash(t.red)],
    ['Jami penaltilar', dash(t.pen)],
  ]
  return (
    <table className="tm-info">
      <caption className="sr-only">Hakam haqida</caption>
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

function CareerTable({ career }) {
  const rows = Array.isArray(career) ? career.filter(Boolean) : []
  if (!rows.length) return null
  return (
    <>
      <h2 className="mp-subtitle">Karyera statistikasi (turnirlar bo'yicha)</h2>
      <div className="table-scroll" role="region" aria-label="Hakam karyerasi" tabIndex={0}>
        <table className="rf-career">
          <caption className="sr-only">Hakam karyerasi turnirlar bo'yicha</caption>
          <thead>
            <tr>
              <th scope="col" className="rf-career__comp">
                Turnir
              </th>
              <th scope="col">O'yin</th>
              <th scope="col">
                <abbr title="O'rtacha sariq">⌀ Sariq</abbr>
              </th>
              <th scope="col">Qizil</th>
              <th scope="col">Penalti</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(c => (
              <tr key={c.id ?? c.name}>
                <td className="rf-career__comp">
                  {c.flag && (
                    <span className="rf-flag" aria-hidden="true">
                      {c.flag}
                    </span>
                  )}{' '}
                  {dash(c.name)}
                </td>
                <td>{dash(c.apps)}</td>
                <td>
                  <span className="rf-yel">{dash(c.avgYellow)}</span>
                </td>
                <td>{dash(c.red)}</td>
                <td>{dash(c.pen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Overview({ r }) {
  const t = r.totals || {}
  return (
    <div className="rf-overview">
      <Kpis t={t} />
      <InfoTable r={r} t={t} />
      <CareerTable career={r.career} />
    </div>
  )
}

function RefereeView({ r }) {
  const [tab, setTab] = useState(TABS[0].id)
  const t = r.totals || {}
  const kicker = <>{r.flag && <span aria-hidden="true">{r.flag} </span>}HAKAM</>
  const avatar = (
    <span className="pl-hero__av rf-whistle" aria-hidden="true">
      ⚖
    </span>
  )
  return (
    <section className="rf">
      <Link to="/score" className="article__back">
        ← Score
      </Link>
      <PersonHero
        name={r.name}
        kicker={kicker}
        avatar={avatar}
        subline={`${dash(r.country)} · ${dash(t.apps)} o'yin boshqargan`}
        stat={{ value: t.pen, cap: 'Penalti' }}
      />
      <Tabs tabs={TABS} value={tab} onChange={setTab} idBase={ID_BASE} label="Hakam bo'limlari" />
      <div className="pl-content">
        <TabPanel idBase={ID_BASE} id="sharh" value={tab}>
          <Overview r={r} />
        </TabPanel>
        <TabPanel idBase={ID_BASE} id="oyin" value={tab}>
          <PersonMatches
            matches={r.matches}
            unavailable={isUnavailable(r.meta, 'matches')}
            emptyText="Bu hakam tayinlangan o'yinlar topilmadi."
          />
        </TabPanel>
      </div>
    </section>
  )
}

export default function Referee({ id }) {
  const { data: r, loading, error, reload } = useApi(o => api.referee(id, o), [id])
  useSeo({
    title: r?.name || 'Hakam',
    description: r?.name ? `${r.name} — hakam: kartalar statistikasi va o'yinlar.` : undefined,
    path: `/referee/${encodeURIComponent(id)}`,
  })
  if (loading) return <Loading />
  if (!r || error?.code === NOT_FOUND.code) {
    const retry = error && error.code !== NOT_FOUND.code ? reload : undefined
    const title = retry ? undefined : 'Hakam topilmadi'
    return <ErrorBox error={error ?? NOT_FOUND} onRetry={retry} title={title} level={1} />
  }
  return <RefereeView r={r} />
}
