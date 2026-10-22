// Ilova qobig'i: masthead, marshrut bo'yicha sahifa (kod bo'linishi bilan), footer.
import { lazy, Suspense, useSyncExternalStore } from 'react'
import { usePathname, useRoute, useFocusOnRouteChange } from './lib/nav.jsx'
import { getSettings, subscribeSettings } from './settings.js'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { Loading } from './components/States.jsx'
import Masthead from './components/layout/Masthead.jsx'
import Footer from './components/layout/Footer.jsx'
import Home from './components/home/Home.jsx'

// Bosh sahifa (eng ko'p ochiladigan, LCP) asosiy bundle'da; qolganlari alohida chunk
const Score = lazy(() => import('./components/Score.jsx'))
const News = lazy(() => import('./components/News.jsx'))
const Archive = lazy(() => import('./components/Archive.jsx'))
const Rankings = lazy(() => import('./components/Rankings.jsx'))
const NewsArticle = lazy(() => import('./components/NewsArticle.jsx'))
const Match = lazy(() => import('./components/Match.jsx'))
const League = lazy(() => import('./components/League.jsx'))
const Team = lazy(() => import('./components/Team.jsx'))
const Player = lazy(() => import('./components/Player.jsx'))
const Coach = lazy(() => import('./components/Coach.jsx'))
const Referee = lazy(() => import('./components/Referee.jsx'))
const Article = lazy(() => import('./components/Article.jsx'))
const NotFound = lazy(() => import('./components/NotFound.jsx'))
const SectionPage = lazy(() => import('./components/home/ListRoutes.jsx').then(m => ({ default: m.SectionPage })))
const SearchPage = lazy(() => import('./components/home/ListRoutes.jsx').then(m => ({ default: m.SearchPage })))

// Marshrut nomi → sahifa komponenti va uning props'i
const PAGES = {
  home: { Page: Home, props: () => ({}) },
  score: { Page: Score, props: () => ({}) },
  news: { Page: News, props: () => ({}) },
  archive: { Page: Archive, props: () => ({}) },
  rankings: { Page: Rankings, props: r => ({ kind: r.kind }) },
  newsArticle: { Page: NewsArticle, props: r => ({ slug: r.slug }) },
  match: { Page: Match, props: r => ({ id: r.id }) },
  league: { Page: League, props: r => ({ id: r.id }) },
  team: { Page: Team, props: r => ({ id: r.id }) },
  player: { Page: Player, props: r => ({ id: r.id }) },
  coach: { Page: Coach, props: r => ({ id: r.id }) },
  referee: { Page: Referee, props: r => ({ id: r.id }) },
  article: { Page: Article, props: r => ({ slug: r.slug }) },
  section: { Page: SectionPage, props: r => ({ section: r.section }) },
  search: { Page: SearchPage, props: r => ({ query: r.query }) },
  notFound: { Page: NotFound, props: () => ({}) },
}

/** Sahifa kaliti: ID/slug o'zgarsa sahifa holati bilan birga qayta yaratiladi. */
export function pageKey(route) {
  return route.name + (route.id || route.slug || route.kind || route.section || route.query || '')
}

function focusMain(e) {
  const main = document.getElementById('main')
  if (!main) return
  e.preventDefault()
  main.focus()
}

export default function App() {
  const pathname = usePathname()
  const route = useRoute()
  // Mavzu/mintaqa o'zgarsa butun daraxt qayta render bo'ladi — o'yin vaqtlari yangi mintaqada formatlanadi
  useSyncExternalStore(subscribeSettings, getSettings)
  useFocusOnRouteChange(pathname)

  const { Page, props } = PAGES[route.name] || PAGES.notFound
  const key = pageKey(route)
  return (
    <div className="paper">
      <a className="skip-link" href="#main" onClick={focusMain}>
        Asosiy mazmunga o'tish
      </a>
      <div className="paper__sheet">
        <Masthead route={route} />
        <main id="main" tabIndex={-1}>
          <ErrorBoundary resetKey={key}>
            <Suspense fallback={<Loading />}>
              <Page key={key} {...props(route)} />
            </Suspense>
          </ErrorBoundary>
        </main>
        <Footer />
      </div>
    </div>
  )
}
