// O'yin qatori (`lg-match`) — Team/Coach/Referee/League sahifalaridagi umumiy qator.
// Butun qator bosiladi (stretched-link), klaviaturada esa hisob havolasi orqali ochiladi.
// Server null maydonlar yuborishi mumkin (API-NOTES, T-03 2/3-iteratsiya): ular "—" bo'lib ko'rinadi.
import Crest from './Crest.jsx'
import { Link } from '../lib/nav.jsx'
import { matchTime } from '../settings.js'

const DASH = '—'
const STATUS_LABELS = {
  ft: 'FT',
  canceled: 'BEKOR QILINDI',
  postponed: 'KECHIKTIRILDI',
  interrupted: "TO'XTATILDI",
}
// Hisob faqat shu holatlarda ko'rsatiladi
const SCORED_STATUSES = new Set(['live', 'ft', 'interrupted'])

const isNum = v => typeof v === 'number' && Number.isFinite(v)
const hasValue = v => v !== null && v !== undefined && v !== ''

/** Holat matni: jonli → daqiqa (yo'q bo'lsa JONLI), yakuniy holatlar → yorliq, status null → bo'sh, aks holda vaqt. */
export function matchStatusText(m) {
  if (!hasValue(m?.status)) return ''
  if (m.status === 'live') return isNum(m.minute) ? `${m.minute}'` : 'JONLI'
  if (Object.hasOwn(STATUS_LABELS, m.status)) return STATUS_LABELS[m.status]
  return matchTime(m) || DASH
}

/** Hisob matni: ikkala hisob raqam va holat hisobli bo'lsa "2 : 1", aks holda "—". */
export function matchScoreText(m) {
  return SCORED_STATUSES.has(m?.status) && isNum(m.hs) && isNum(m.as) ? `${m.hs} : ${m.as}` : DASH
}

function TeamCell({ team, away = false }) {
  const name = team?.n || DASH
  const crest = <Crest name={team?.n || ''} c={team?.c} id={team?.id ?? undefined} kind="team" size="sm" />
  return (
    <span className={`lg-match__team${away ? ' lg-match__team--a' : ''}`}>
      {away ? (
        <>
          {name} {crest}
        </>
      ) : (
        <>
          {crest} {name}
        </>
      )}
    </span>
  )
}

/**
 * @param {{ match: { id: string|number|null, status?: string|null, minute?: number|null, hs?: number|null,
 *   as?: number|null, ts?: number|null, time?: string|null, home?: { n?: string|null, c?: string, id?: string|number|null },
 *   away?: { n?: string|null, c?: string, id?: string|number|null } } }} props
 */
export default function MatchRow({ match: m }) {
  const live = m.status === 'live'
  const score = matchScoreText(m)
  const status = matchStatusText(m)
  const linkable = hasValue(m.id)
  const homeName = m.home?.n || DASH
  const awayName = m.away?.n || DASH
  return (
    <div className={`lg-match ${linkable ? 'is-linkrow' : 'is-static'}`}>
      <span className={`lg-match__status${live ? ' is-live' : ''}`}>
        {live && isNum(m.minute) && <span className="sr-only">Jonli, </span>}
        {status}
      </span>
      <TeamCell team={m.home} />
      {linkable ? (
        <Link
          to={`/match/${encodeURIComponent(m.id)}`}
          className="lg-match__score stretched-link"
          aria-label={`${homeName} ${score} ${awayName}, o'yin sahifasi`}
        >
          {score}
        </Link>
      ) : (
        <span className="lg-match__score">{score}</span>
      )}
      <TeamCell team={m.away} away />
    </div>
  )
}
