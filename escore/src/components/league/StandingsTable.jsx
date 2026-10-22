// Turnir jadvali (a11y): caption, th scope, qisqartmalar <abbr>, keng jadval uchun fokuslanadigan .table-scroll.
// Shu yerda: boshqa sahifalar (o'yin/jamoa) uchun liga jadvali paneli.
import { api, useApi } from '../../api.js'
import Crest from '../Crest.jsx'
import { FormList } from '../FormBadge.jsx'
import { AsyncView } from '../States.jsx'
import { Link } from '../../lib/nav.jsx'
import Unavailable from './Unavailable.jsx'
import { dash, isUnavailable } from './shared.js'
import { goalDiff, groupsOf, standingsView } from './standings.js'

function ClubCell({ r }) {
  const inner = (
    <>
      <Crest name={r.name} c={r.c} id={r.id ?? undefined} kind="team" size="sm" />
      <span className="lg-club__name">{dash(r.name)}</span>
    </>
  )
  return (
    <th scope="row" className="lg-table__club">
      <span className="lg-club__inner">
        {r.id != null ? (
          <Link to={`/team/${encodeURIComponent(r.id)}`} className="lg-club__link">
            {inner}
          </Link>
        ) : (
          inner
        )}
      </span>
    </th>
  )
}

// [qisqartma, to'liq nomi, qo'shimcha klass]
const COLUMNS = [
  ["O'", "O'yinlar"],
  ["G'", "G'alabalar"],
  ['D', 'Duranglar'],
  ['M', "Mag'lubiyatlar"],
  ['U-Z', "Urilgan va o'tkazilgan gollar", 'lg-hide-sm'],
  ['F', 'Gollar farqi'],
  ['O', 'Ochkolar'],
]

function Head({ showForm }) {
  return (
    <thead>
      <tr>
        <th scope="col">
          <abbr title="O'rin">#</abbr>
        </th>
        <th scope="col" className="lg-table__club">
          Klub
        </th>
        {COLUMNS.map(([short, full, cls]) => (
          <th key={short} scope="col" className={cls}>
            <abbr title={full}>{short}</abbr>
          </th>
        ))}
        {showForm && (
          <th scope="col" className="lg-hide-sm">
            Forma
          </th>
        )}
      </tr>
    </thead>
  )
}

function Row({ r, highlighted, showForm }) {
  const gd = goalDiff(r.GD)
  const goals = r.GF == null && r.GA == null ? dash(null) : `${dash(r.GF)}:${dash(r.GA)}`
  return (
    <tr className={highlighted ? 'tm-row-hl' : undefined}>
      <td className="lg-pos">{dash(r.pos)}</td>
      <ClubCell r={r} />
      <td>{dash(r.P)}</td>
      <td>{dash(r.W)}</td>
      <td>{dash(r.D)}</td>
      <td>{dash(r.L)}</td>
      <td className="lg-hide-sm">{goals}</td>
      <td className={gd.cls || undefined}>{gd.text}</td>
      <td className="lg-pts">{dash(r.Pts)}</td>
      {showForm && (
        <td className="lg-hide-sm">
          <FormList form={r.form} />
        </td>
      )}
    </tr>
  )
}

/**
 * @param {{ rows: object[], caption: string, highlightIds?: Array<string|number>, showForm?: boolean }} props
 *   — `rows` standingsView() natijasi
 */
export default function StandingsTable({ rows, caption, highlightIds = [], showForm = false }) {
  const hl = new Set(highlightIds.filter(v => v != null).map(String))
  return (
    <div className="table-scroll" role="region" aria-label={caption} tabIndex={0}>
      <table className="lg-table">
        <caption className="sr-only">{caption}</caption>
        <Head showForm={showForm} />
        <tbody>
          {rows.map((r, i) => (
            <Row
              key={r.id ?? `${r.name}-${i}`}
              r={r}
              highlighted={r.id != null && hl.has(String(r.id))}
              showForm={showForm}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Ko'p guruhli turnirda faqat kerakli jamoalar guruhi ko'rsatiladi (topilmasa — hammasi)
function relevantGroups(groups, ids) {
  const wanted = new Set(ids.filter(v => v != null).map(String))
  const hit = groups.filter(g => (g.rows || []).some(r => r?.id != null && wanted.has(String(r.id))))
  return hit.length ? hit : groups
}

function PanelBody({ data, highlightIds, title }) {
  const all = groupsOf(data)
  const groups = relevantGroups(all, highlightIds)
  return (
    <div>
      <Unavailable meta={data.meta} parts={['standings']} label="Jadval" />
      {groups.length === 0 && !isUnavailable(data.meta, ['standings']) && (
        <p className="mp-empty">Bu turnir uchun jadval mavjud emas.</p>
      )}
      {groups.map((g, i) => (
        <StandingsTable
          key={g.name || i}
          rows={standingsView(g.rows, 'all')}
          caption={g.name && all.length > 1 ? `${title}: ${g.name}` : title}
          highlightIds={highlightIds}
        />
      ))}
    </div>
  )
}

/**
 * O'yin/jamoa sahifasi ichidagi haqiqiy liga jadvali (/api/leagues/:id), kerakli jamoalar ajratilgan.
 * @param {{ leagueId: string, highlightIds?: Array<string|number>, title?: string }} props
 */
export function LeagueTablePanel({ leagueId, highlightIds = [], title = 'Turnir jadvali' }) {
  const state = useApi(o => api.league(leagueId, undefined, o), [leagueId])
  return (
    <AsyncView state={state} isEmpty={d => d == null}>
      {data => <PanelBody data={data} highlightIds={highlightIds} title={title} />}
    </AsyncView>
  )
}
