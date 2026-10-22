// Asosiy bo'limlar navigatsiyasi (faol havolada aria-current="page")
import { Link } from '../../lib/nav.jsx'
import SearchBox from './SearchBox.jsx'
import SettingsMenu from './SettingsMenu.jsx'

import { SECTIONS, sectionPath } from './sections.js'

export const NAV_ITEMS = [
  { label: 'Bosh sahifa', to: '/' },
  { label: 'Score', to: '/score' },
  { label: 'Yangiliklar', to: '/news' },
  { label: 'Arxiv', to: '/archive' },
  ...SECTIONS.filter(s => s.inNav !== false).map(s => ({ label: s.label, to: sectionPath(s.name) })),
]

const SCORE_ROUTES = new Set(['score', 'match', 'league', 'team', 'player', 'coach', 'referee', 'rankings'])

/**
 * Marshrutga mos faol bo'lim yo'li (yoki null).
 * @param {{ name: string, section?: string }} route
 * @returns {string|null}
 */
export function activeNavPath(route) {
  if (route.name === 'home') return '/'
  if (route.name === 'archive') return '/archive'
  if (route.name === 'section') return sectionPath(route.section)
  if (route.name === 'news' || route.name === 'newsArticle') return '/news'
  if (SCORE_ROUTES.has(route.name)) return '/score'
  return null
}

export default function Nav({ route }) {
  const active = activeNavPath(route)
  return (
    <nav className="masthead__nav" aria-label="Asosiy bo'limlar">
      <div className="masthead__links">
        {NAV_ITEMS.map(n => {
          const isActive = active === n.to
          return (
            <Link
              key={n.to}
              to={n.to}
              className={isActive ? 'is-active' : undefined}
              aria-current={isActive ? 'page' : undefined}
            >
              {n.label}
            </Link>
          )
        })}
      </div>
      <div className="masthead__tools">
        <SearchBox />
        <SettingsMenu />
      </div>
    </nav>
  )
}
