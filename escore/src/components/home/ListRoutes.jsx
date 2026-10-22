// Ro'yxat sahifalari: bo'lim (/section/:name) va qidiruv (/search/:q). Ko'rinish ListPage'da.
import { api, useApi } from '../../api.js'
import { useSeo } from '../../lib/seo.js'
import { ErrorBox, Loading } from '../States.jsx'
import ListPage from '../ListPage.jsx'
import NotFound from '../NotFound.jsx'
import { isKnownSection } from '../layout/sections.js'

function SectionList({ section }) {
  const { data, loading, error, reload } = useApi(opts => api.news(opts), [])
  useSeo({ title: section, description: `eSCORE: «${section}» bo'limidagi maqolalar` })
  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} level={1} />
  const items = (Array.isArray(data) ? data : []).filter(a => a.section === section)
  return (
    <ListPage eyebrow="BO'LIM" title={section} note={`Ushbu bo'limda ${items.length} ta maqola`} articles={items} />
  )
}

// Oq ro'yxatda yo'q bo'lim nomi → 404 (cheksiz indekslanadigan bo'sh sahifalar paydo bo'lmasin)
export function SectionPage({ section }) {
  return isKnownSection(section) ? <SectionList section={section} /> : <NotFound />
}

export function SearchPage({ query }) {
  const { data, loading, error, reload } = useApi(opts => api.search(query, opts), [query])
  // Qidiruv natijalari indekslanmaydi (robots.txt ham /search/ ni yopadi)
  useSeo({ title: `Qidiruv: ${query}`, noindex: true })
  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} level={1} />
  const items = Array.isArray(data?.articles) ? data.articles : []
  return (
    <ListPage
      eyebrow="QIDIRUV NATIJALARI"
      title={`«${query}»`}
      note={`${items.length} ta natija topildi`}
      articles={items}
    />
  )
}
