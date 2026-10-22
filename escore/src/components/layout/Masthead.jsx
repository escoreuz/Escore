// Gazeta sarlavhasi: son raqami (/api/bootstrap), logo (h1 EMAS), bugungi sana (Toshkent), navigatsiya.
import { api, useApi } from '../../api.js'
import { Link } from '../../lib/nav.jsx'
import { fmtTashkentDate } from '../../lib/format.js'
import Nav from './Nav.jsx'

const DEFAULT_CITY = 'TOSHKENT'

/**
 * Masthead sanasi: "Payshanba, 15-oktabr 2026" (Asia/Tashkent).
 * @param {Date} [now]
 */
export function mastheadDate(now = new Date()) {
  return fmtTashkentDate(now, { weekday: true })
}

function issueLine(issue) {
  if (!issue) return 'eSCORE'
  return [issue.volume, issue.no].filter(Boolean).join(' · ') || 'eSCORE'
}

export default function Masthead({ route }) {
  // Bootstrap ishlamasa masthead son raqamisiz ko'rsatiladi (xato useApi ichida loglanadi)
  const { data } = useApi(opts => api.bootstrap(opts), [])
  const issue = data?.issue
  return (
    <header className="masthead">
      <div className="masthead__top">
        <span>{issueLine(issue)}</span>
        <span>ONLAYN NASHR</span>
      </div>

      <div className="masthead__title">
        <div className="logo">
          <Link to="/" className="logo__link" aria-label="eSCORE — bosh sahifa">
            e<span className="logo__score">SCORE</span>
          </Link>
        </div>
      </div>

      <p className="masthead__motto">FUTBOL GAZETASI · «Maydondagi har bir lahza — tarix»</p>

      <div className="masthead__dateline">
        <span>{issue?.city || DEFAULT_CITY}</span>
        <span>{mastheadDate()}</span>
        <span>escore.uz</span>
      </div>

      <Nav route={route} />
    </header>
  )
}
