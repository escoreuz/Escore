// O'yinchi sharhi: o'rtacha reyting, xususiyatlar radari, oylik reyting va kuchli/zaif tomonlar.
// Server bermagan xususiyatlar (attrs [] yoki val null) uchun radar chizilmaydi — uydirma qiymat yo'q.
import { isUnavailable, ratingColor, ratingText, ratingValue } from './display.js'
import Unavailable from './Unavailable.jsx'

const RADAR = { cx: 110, cy: 105, radius: 84, labelGap: 16, size: 220 }
const GRID_STEPS = [0.25, 0.5, 0.75, 1]
const ATTR_MAX = 100
const MIN_RADAR_AXES = 3
const MONTHLY_SCALE = { min: 5.5, max: 8.0 }

/** Faqat qiymati ma'lum xususiyatlar. */
export const knownAttrs = attrs =>
  Array.isArray(attrs) ? attrs.filter(a => a && typeof a.label === 'string' && Number.isFinite(a.val)) : []

function radarPoint(i, count, r) {
  const ang = -Math.PI / 2 + (i * 2 * Math.PI) / count
  return [RADAR.cx + Math.cos(ang) * r, RADAR.cy + Math.sin(ang) * r]
}

/** N o'qli radar (ko'pburchak). `attrs` — faqat ma'lum qiymatlar (≥ 3 ta). */
export function Radar({ attrs }) {
  const n = attrs.length
  const pt = (i, r) => radarPoint(i, n, r)
  const grid = GRID_STEPS.map(f => attrs.map((_, i) => pt(i, RADAR.radius * f).join(',')).join(' '))
  const poly = attrs.map((a, i) => pt(i, RADAR.radius * (a.val / ATTR_MAX)).join(',')).join(' ')
  const label = `Xususiyatlar: ${attrs.map(a => `${a.label} ${a.val}`).join(', ')}`
  return (
    <svg
      className="pl-radar"
      viewBox={`0 0 ${RADAR.size} ${RADAR.size}`}
      width={RADAR.size}
      height={RADAR.size}
      role="img"
      aria-label={label}
    >
      {grid.map(g => (
        <polygon key={g} points={g} fill="none" stroke="var(--line-soft)" strokeWidth="1" />
      ))}
      {attrs.map((a, i) => {
        const [x, y] = pt(i, RADAR.radius)
        return (
          <line key={a.label} x1={RADAR.cx} y1={RADAR.cy} x2={x} y2={y} stroke="var(--line-soft)" strokeWidth="1" />
        )
      })}
      <polygon points={poly} fill="rgba(138,28,28,0.22)" stroke="var(--accent)" strokeWidth="2" />
      {attrs.map((a, i) => {
        const [x, y] = pt(i, RADAR.radius + RADAR.labelGap)
        return (
          <text key={a.label} x={x} y={y} className="pl-radar__label" textAnchor="middle" dominantBaseline="middle">
            {a.label}
          </text>
        )
      })}
    </svg>
  )
}

const barHeight = rating => {
  const v = ratingValue(rating)
  if (v == null) return 0
  const pct = ((v - MONTHLY_SCALE.min) / (MONTHLY_SCALE.max - MONTHLY_SCALE.min)) * 100
  return Math.max(0, Math.min(100, pct))
}

/** So'nggi 12 oy — oylik o'rtacha reyting (ustun diagramma). Reyting umuman yo'q bo'lsa chizilmaydi. */
export function MonthlyChart({ data }) {
  if (!Array.isArray(data) || !data.some(d => ratingValue(d?.rating) != null)) return null
  return (
    <section className="pl-monthly">
      <h2 className="mp-subtitle">So'nggi 12 oy — o'rtacha reyting</h2>
      <div className="pl-bars">
        {data.map((d, i) => {
          const v = ratingValue(d.rating)
          return (
            <div key={d.label ?? i} className="pl-bar">
              <div className="pl-bar__track">
                <span
                  className="pl-bar__fill"
                  style={{ height: barHeight(d.rating) + '%', background: ratingColor(d.rating) ?? undefined }}
                />
              </div>
              <span className="pl-bar__val">{v != null ? v.toFixed(1) : '—'}</span>
              <span className="pl-bar__mon">{d.label}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function TagColumn({ title, items, variant }) {
  if (!items.length) return null
  return (
    <div className="pl-sw__col">
      <h2 className="mp-subtitle">{title}</h2>
      <ul className="pl-tags">
        {items.map(s => (
          <li key={s} className={`pl-tag ${variant}`}>
            {s}
          </li>
        ))}
      </ul>
    </div>
  )
}

const asList = v => (Array.isArray(v) ? v.filter(Boolean) : [])

/** Sharh paneli (yon ustun). */
export default function Overview({ p }) {
  const attrs = knownAttrs(p.attrs)
  const strengths = asList(p.strengths)
  const weaknesses = asList(p.weaknesses)
  const hasRadar = attrs.length >= MIN_RADAR_AXES
  const hasTags = strengths.length > 0 || weaknesses.length > 0
  const attrsMissing = isUnavailable(p.meta, 'attrs')
  return (
    <div className="pl-overview">
      <div className="pl-radarbox pl-radarbox--solo">
        <div className="pl-rating">
          <span className="pl-rating__num">{ratingText(p.rating)}</span>
          <span className="pl-rating__cap">O'rtacha reyting</span>
        </div>
        {hasRadar && <Radar attrs={attrs} />}
      </div>
      {attrsMissing && <Unavailable>Xususiyatlar ma'lumoti yuklanmadi — manba javob bermadi.</Unavailable>}
      {!attrsMissing && !hasRadar && !hasTags && <p className="mp-empty">Xususiyatlar bo'yicha ma'lumot yo'q.</p>}
      {isUnavailable(p.meta, 'monthly') ? (
        <Unavailable>Oylik reyting yuklanmadi — manba javob bermadi.</Unavailable>
      ) : (
        <MonthlyChart data={p.monthly} />
      )}
      {hasTags && (
        <div className="pl-sw">
          <TagColumn title="Kuchli tomonlari" items={strengths} variant="is-strong" />
          <TagColumn title="Kuchsiz tomonlari" items={weaknesses} variant="is-weak" />
        </div>
      )}
    </div>
  )
}
