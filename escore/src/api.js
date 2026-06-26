// eSOCRE backend bilan ishlovchi API-klient
import { useState, useEffect } from 'react'

// Render'da VITE_API_URL faqat hostname bo'lishi mumkin (masalan escore-backend.onrender.com)
// — protokol bo'lmasa https:// qo'shamiz. Lokal ishlashda default localhost:4500.
const RAW_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4500'
const BASE = /^https?:\/\//.test(RAW_BASE) ? RAW_BASE : 'https://' + RAW_BASE

async function get(path) {
  const r = await fetch(BASE + path)
  if (!r.ok) throw new Error('API ' + r.status)
  return r.json()
}
async function send(method, path, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error('API ' + r.status)
  return r.json()
}

const enc = encodeURIComponent

export const api = {
  base: BASE,
  home: () => get('/api/home'),
  news: () => get('/api/news'),
  article: (slug) => get('/api/news/' + enc(slug)),
  createNews: (data) => send('POST', '/api/news', data),
  updateNews: (slug, data) => send('PUT', '/api/news/' + enc(slug), data),
  deleteNews: (slug) => send('DELETE', '/api/news/' + enc(slug)),
  search: (q) => get('/api/search?q=' + enc(q)),
  feed: () => get('/api/feed'),
  newsArticle: (slug) => get('/api/feed/' + enc(slug)),
  archive: ({ q = '', category = '', page = 0 } = {}) =>
    get(`/api/archive?q=${enc(q)}&category=${enc(category)}&page=${page}`),
  countries: () => get('/api/countries'),
  countryLeagues: (id) => get('/api/countries/' + enc(id) + '/leagues'),
  rankings: (kind) => get('/api/rankings/' + enc(kind)),
  days: () => get('/api/days'),
  matches: ({ date, status, q } = {}) =>
    get(`/api/matches?date=${enc(date || '')}&status=${status || 'all'}&q=${enc(q || '')}`),
  match: (id) => get('/api/matches/' + enc(id)),
  featured: () => get('/api/featured'),
  scorers: () => get('/api/scorers'),
  standingsMini: () => get('/api/standings-mini'),
  league: (id, season) => get('/api/leagues/' + enc(id) + (season ? '?season=' + enc(season) : '')),
  team: (id) => get('/api/teams/' + enc(id)),
  player: (id) => get('/api/players/' + enc(id)),
  playerCareer: (id) => get('/api/players/' + enc(id) + '/career'),
  playerSeason: (id, tid, sid) => get(`/api/players/${enc(id)}/season?tid=${enc(tid)}&sid=${enc(sid)}`),
  coach: (id) => get('/api/coaches/' + enc(id)),
  referee: (id) => get('/api/referees/' + enc(id)),
  // Rasm URL (logo/o'yinchi/...) — to'g'ridan-to'g'ri <img src> uchun
  img: (kind, id) => `${BASE}/api/img/${enc(kind)}/${enc(id)}`,
}

// Ma'lumotni yuklovchi hook: {data, loading, error}
export function useApi(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    Promise.resolve(fn())
      .then((d) => { if (alive) setState({ data: d, loading: false, error: null }) })
      .catch((e) => { if (alive) setState({ data: null, loading: false, error: e.message }) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}
