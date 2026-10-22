// app testlari uchun umumiy yordamchilar: soxta sofa/archive va ilovani listen(0) da ishga tushirish.
// Fayl nomi *.test.js emas — test sifatida alohida ishga tushmaydi.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createApp } from '../app.js'
import { createStore, validateArticle } from '../store.js'
import { UpstreamError, NotFoundError } from '../errors.js'

export const TOKEN = 'test-admin-token-0123456789'
export const SEED = [
  { slug: 'birinchi', title: 'Birinchi maqola', standfirst: 'Kirish', date: '2026-10-01', body: ['Matn'] },
  { slug: 'ikkinchi', title: 'Ikkinchi maqola', standfirst: '', date: '2026-10-02', body: ['Matn 2'] },
]
export const upstreamDown = () => {
  throw new UpstreamError('score-api 503 /x', { status: 503 })
}
export const silentLogger = () => {
  const calls = { info: [], warn: [], error: [] }
  return { calls, info: m => calls.info.push(m), warn: m => calls.warn.push(m), error: m => calls.error.push(m) }
}

export function fakeArchive(articles = {}) {
  const saved = []
  return {
    saved,
    saveCards: () => {},
    saveArticle: a => saved.push(a.slug),
    getArticle: slug => (Object.hasOwn(articles, slug) ? articles[slug] : null),
    list: ({ page = 0, size = 24 } = {}) => {
      const all = Object.values(articles)
      const items = all.slice(page * size, page * size + size).map(a => ({ slug: a.slug, title: a.title }))
      return { items, total: all.length, page, size, hasMore: (page + 1) * size < all.length, categories: [] }
    },
  }
}

export function fakeSofa(overrides = {}) {
  return {
    days: () => ({ today: '2026-10-15', days: [] }),
    matchesByDate: async () => [],
    matchesForDate: async () => ({ matches: [], partial: false }),
    home: upstreamDown,
    news: async () => [],
    article: async () => {
      throw new NotFoundError('yo`q')
    },
    team: upstreamDown,
    league: async () => ({ league: { id: 17 } }),
    scorers: upstreamDown,
    standingsMini: async () => [],
    fetchImage: async () => ({ buf: Buffer.from('png'), type: 'image/png' }),
    ...overrides,
  }
}

const servers = []
const tmpDirs = []
export async function start({ sofa = fakeSofa(), archive = fakeArchive(), env = {}, mode = 'real', rateLimits } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'escore-app-'))
  tmpDirs.push(dir)
  const logger = silentLogger()
  const store = { ...createStore({ file: join(dir, 'news.json'), seed: SEED, logger }), validateArticle }
  const app = createApp({
    sofa,
    store,
    archive,
    mode,
    logger,
    env: { SITE_URL: 'https://escore.test', ...env },
    rateLimits,
  })
  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
  servers.push(server)
  const base = `http://127.0.0.1:${server.address().port}`
  const call = (path, init) => fetch(base + path, init)
  return { call, logger, archive }
}

/** Barcha ishga tushirilgan serverlarni yopadi va vaqtinchalik papkalarni o'chiradi (after() da). */
export async function closeAll() {
  await Promise.all(servers.splice(0).map(s => new Promise(r => s.close(r))))
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true })
}
