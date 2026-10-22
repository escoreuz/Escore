// Bosh sahifa (gazeta): /api/home ma'lumoti. Bo'limlar manbai ishlamasa meta.unavailable bo'yicha ko'rsatiladi.
import { api, useApi } from '../../api.js'
import { useSeo, siteUrl } from '../../lib/seo.js'
import { ErrorBox, Loading } from '../States.jsx'
import Ticker from '../layout/Ticker.jsx'
import Lead from './Lead.jsx'
import { Columns, Quote, SecondaryStories } from './Stories.jsx'
import Standings from './Standings.jsx'
import { Briefs, Fixtures, Results } from './Matches.jsx'

const HOME_TITLE = 'Futbol yangiliklari, natijalar va turnir jadvallari'
export const PARTIAL_TEXT = "Ba'zi ma'lumotlar vaqtincha to'liq yuklanmadi — sahifa qisman ko'rsatilmoqda."

function homeJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'eSCORE',
    url: siteUrl() + '/',
    inLanguage: 'uz',
  }
}

function HomeContent({ h }) {
  const unavailable = new Set(Array.isArray(h.meta?.unavailable) ? h.meta.unavailable : [])
  return (
    <>
      {h.meta?.partial === true && <p className="unavailable">{PARTIAL_TEXT}</p>}
      <Ticker items={h.ticker} />
      <div className="grid">
        <div className="grid__main">
          <Lead a={h.lead} />
          <hr className="hr" />
          <SecondaryStories items={h.secondary} />
          <hr className="hr" />
          <Quote quote={h.quote} />
          <hr className="hr" />
          <Columns items={h.columns} />
        </div>

        <aside className="grid__side" aria-label="Jadval va natijalar">
          <Standings rows={h.standings} unavailable={unavailable.has('standings')} />
          <Results items={h.results} unavailable={unavailable.has('results')} />
          <Fixtures items={h.fixtures} unavailable={unavailable.has('fixtures')} />
          <Briefs items={h.briefs} />
        </aside>
      </div>
    </>
  )
}

export default function Home() {
  const { data, loading, error, reload } = useApi(opts => api.home(opts), [])
  useSeo({ title: HOME_TITLE, path: '/', jsonLd: homeJsonLd() })
  return (
    <>
      <h1 className="sr-only">eSCORE — o'zbek tilidagi futbol yangiliklari</h1>
      {loading && <Loading label="Bosh sahifa yuklanmoqda…" />}
      {!loading && (error || !data) && <ErrorBox error={error} onRetry={reload} />}
      {!loading && !error && data && <HomeContent h={data} />}
    </>
  )
}
