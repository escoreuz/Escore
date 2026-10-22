// "Mavsum" tabi: turnir/mavsum tanlash + o'yinma-o'yin reyting tasmasi + issiqlik xaritasi + statistika.
import { useId } from 'react'
import { api, useApi } from '../../api.js'
import { Link } from '../../lib/nav.jsx'
import Crest from '../Crest.jsx'
import { ErrorBox, Loading } from '../States.jsx'
import { dash, isUnavailable, ratingStyle, ratingText, ratingValue, shortDate } from './display.js'
import Unavailable from './Unavailable.jsx'

const DOT = { minOpacity: 0.2, opacityRange: 0.55, minScale: 0.7, scaleRange: 1.1 }

function statRows(s) {
  const common = [
    ['Ishtiroklar', s.appearances],
    ['Asosiy tarkibda', s.started],
    ["O'rtacha daqiqa", s.minutesPerGame],
    ['Jami daqiqa', s.totalMinutes],
  ]
  const extra = s.isGK
    ? [
        ["To'xtatishlar", s.saves],
        ["Quruq o'yin", s.cleanSheet],
      ]
    : [
        ['Gollar', s.goals],
        ['Assistlar', s.assists],
      ]
  return [...common, ...extra]
}

function SeasonStats({ s }) {
  return (
    <table className="pls-stats">
      <caption className="sr-only">Mavsum statistikasi</caption>
      <tbody>
        {statRows(s).map(([k, v]) => (
          <tr key={k}>
            <th scope="row">{k}</th>
            <td>{dash(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Mavsum issiqlik xaritasi (gorizontal maydon, o'yinchi darvozasi chapda). */
function Heatmap({ points }) {
  if (!points.length) return <p className="mp-empty">Issiqlik xaritasi mavjud emas.</p>
  const max = Math.max(1, ...points.map(p => p.count || 1))
  return (
    <div className="pls-pitch" role="img" aria-label="Mavsum issiqlik xaritasi">
      <span className="pls-pitch__half" />
      <span className="pls-pitch__circle" />
      <span className="pls-pitch__box pls-pitch__box--l" />
      <span className="pls-pitch__box pls-pitch__box--r" />
      {points.map((pt, i) => {
        const t = (pt.count || 1) / max
        const style = {
          left: pt.x + '%',
          top: pt.y + '%',
          opacity: DOT.minOpacity + t * DOT.opacityRange,
          transform: `translate(-50%,-50%) scale(${DOT.minScale + t * DOT.scaleRange})`,
        }
        return <span key={`${pt.x}-${pt.y}-${i}`} className="pls-dot" style={style} />
      })}
    </div>
  )
}

function TimelineItem({ t }) {
  const content = (
    <>
      <span className="pls-mtl__date">{shortDate(t.date)}</span>
      {t.oppId != null ? (
        <Crest name={t.oppName} c={t.oppColor} id={t.oppId} size="sm" />
      ) : (
        <span className="pls-mtl__noopp" aria-hidden="true">
          ⚽
        </span>
      )}
      <span className="pls-mtl__rt" style={ratingStyle(t.rating)}>
        {ratingText(t.rating)}
      </span>
    </>
  )
  if (t.matchId == null) return <span className="pls-mtl">{content}</span>
  const label = `${t.oppName || 'Raqib'} bilan o'yin, ${shortDate(t.date) || "sana noma'lum"}, reyting ${ratingText(t.rating)}`
  return (
    <Link to={`/match/${encodeURIComponent(t.matchId)}`} className="pls-mtl" aria-label={label}>
      {content}
    </Link>
  )
}

function Timeline({ items }) {
  if (!items.some(t => ratingValue(t?.rating) != null)) return null
  return (
    <section className="pls-tl">
      <h2 className="mp-subtitle">O'rtacha reyting · o'yinma-o'yin</h2>
      <div className="pls-tl__row">
        {items.map((t, i) => (
          <TimelineItem key={t.matchId ?? `${t.date}-${i}`} t={t} />
        ))}
      </div>
    </section>
  )
}

function SeasonBody({ state }) {
  const { data, error, loading, reload } = state
  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} title="Mavsum ma'lumotini yuklab bo'lmadi" />
  const summary = data?.summary
  if (!summary) return <p className="mp-empty">Ma'lumot topilmadi.</p>
  const heatmap = Array.isArray(data.heatmap) ? data.heatmap : []
  return (
    <>
      {isUnavailable(data.meta, 'timeline') ? (
        <Unavailable>Reyting tasmasi yuklanmadi — manba javob bermadi.</Unavailable>
      ) : (
        <Timeline items={Array.isArray(data.timeline) ? data.timeline : []} />
      )}
      <div className="pls-grid">
        <section>
          <h2 className="mp-subtitle">Mavsum issiqlik xaritasi</h2>
          {isUnavailable(data.meta, 'heatmap') ? (
            <Unavailable>Issiqlik xaritasi yuklanmadi — manba javob bermadi.</Unavailable>
          ) : (
            <Heatmap points={heatmap} />
          )}
        </section>
        <section>
          <h2 className="mp-subtitle">O'yinlar statistikasi</h2>
          <SeasonStats s={summary} />
        </section>
      </div>
    </>
  )
}

function SeasonPicker({ list, sel, onSelect, summary }) {
  const selectId = useId()
  const cur = list[sel]
  return (
    <header className="pls-head">
      <Crest name={cur.name} id={cur.tid} kind="tournament" size="sm" />
      <label htmlFor={selectId} className="sr-only">
        Turnir va mavsum
      </label>
      <select id={selectId} className="pls-select" value={sel} onChange={e => onSelect(Number(e.target.value))}>
        {list.map((x, i) => (
          <option key={`${x.tid}-${x.sid}`} value={i}>
            {x.name} · {x.year}
          </option>
        ))}
      </select>
      {summary && ratingValue(summary.rating) != null && (
        <span className="pls-avg" style={ratingStyle(summary.rating)}>
          {summary.rating}
        </span>
      )}
    </header>
  )
}

/**
 * @param {{ playerId: string|number, seasons?: { tid: any, sid: any, name: string, year: string }[],
 *   sel: number, onSelect: (i: number) => void, unavailable?: boolean }} props
 * `sel` ota komponentda saqlanadi — tab almashganda tanlangan mavsum yo'qolmaydi.
 */
export default function SeasonTab({ playerId, seasons, sel, onSelect, unavailable = false }) {
  const list = Array.isArray(seasons) ? seasons.filter(x => x && x.tid != null && x.sid != null) : []
  const cur = list[sel] ?? list[0]
  const index = list[sel] ? sel : 0
  const state = useApi(
    o => (cur ? api.playerSeason(playerId, cur.tid, cur.sid, o) : Promise.resolve(null)),
    [playerId, cur?.tid ?? null, cur?.sid ?? null],
  )
  if (unavailable) return <Unavailable>Mavsumlar ro'yxati yuklanmadi — manba javob bermadi.</Unavailable>
  if (!cur) return <p className="mp-empty">Mavsum ma'lumoti topilmadi.</p>
  return (
    <div className="pls">
      <SeasonPicker list={list} sel={index} onSelect={onSelect} summary={state.data?.summary} />
      <SeasonBody state={state} />
    </div>
  )
}
