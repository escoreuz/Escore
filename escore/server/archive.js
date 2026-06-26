// Yangiliklar arxivi — ko'rilgan har bir maqola JSON faylga saqlanadi
// (server/db/archive.json). Vaqt o'tib lenta yangilansa ham eski maqolalar
// arxivda qoladi va qidiriladi. To'liq matn ham saqlanadi (qidiruv + offline o'qish).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'db')
const FILE = join(DATA_DIR, 'archive.json')

function load() {
  try { return JSON.parse(readFileSync(FILE, 'utf8')) } catch { return {} }
}
let store = load() // { [slug]: {...} }

let dirty = false
function persist() {
  if (!dirty) return
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
    writeFileSync(FILE, JSON.stringify(store), 'utf8')
    dirty = false
  } catch { /* yozib bo'lmasa jim o'tamiz */ }
}

function blocksText(a) {
  return (a.blocks || []).map((b) => b.text).join(' ')
}

// Lenta kartalarini saqlaymiz (yengil — matnsiz)
export function saveCards(items = []) {
  for (const it of items) {
    if (!it.slug) continue
    const prev = store[it.slug] || {}
    store[it.slug] = {
      ...prev,
      slug: it.slug, id: it.id,
      title: it.title, subtitle: it.subtitle ?? prev.subtitle ?? '',
      image: it.image ?? prev.image, league: it.league ?? prev.league,
      date: prev.date || it.date || new Date().toISOString(),
      savedAt: prev.savedAt || Date.now(),
    }
    dirty = true
  }
  persist()
}

// To'liq maqolani saqlaymiz (bloklar bilan)
export function saveArticle(a) {
  if (!a?.slug) return
  const prev = store[a.slug] || {}
  store[a.slug] = {
    ...prev,
    slug: a.slug, id: a.id,
    title: a.title, subtitle: a.excerpt ?? prev.subtitle ?? '',
    excerpt: a.excerpt, image: a.image ?? prev.image, league: a.league ?? prev.league,
    author: a.author, blocks: a.blocks, sourceUrl: a.sourceUrl,
    date: a.date || prev.date || new Date().toISOString(),
    savedAt: prev.savedAt || Date.now(),
  }
  dirty = true
  persist()
}

// To'liq maqola (arxivdan) — SofaScore'da yo'q bo'lsa zaxira sifatida
export function getArticle(slug) {
  const a = store[slug]
  if (!a || !a.blocks) return null
  return {
    id: a.id, slug: a.slug, title: a.title, excerpt: a.excerpt || a.subtitle || '',
    image: a.image, author: a.author || 'SofaScore', league: a.league || 'Futbol',
    date: a.date, time: relTime(a.date), blocks: a.blocks, sourceUrl: a.sourceUrl,
    fromArchive: true,
  }
}

function relTime(iso) {
  const ts = Math.floor(new Date(iso).getTime() / 1000)
  if (!ts) return ''
  const diff = Math.abs(Math.floor(Date.now() / 1000 - ts))
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))} daqiqa oldin`
  if (diff < 86400) return `${Math.floor(diff / 3600)} soat oldin`
  return `${Math.floor(diff / 86400)} kun oldin`
}

// Arxiv ro'yxati — qidiruv + kategoriya + sahifalash
export function list({ q = '', category = '', page = 0, size = 24 } = {}) {
  let arr = Object.values(store)

  if (category) {
    const c = category.toLowerCase()
    arr = arr.filter((a) => (a.league || '').toLowerCase() === c)
  }
  if (q) {
    const t = q.toLowerCase()
    arr = arr.filter((a) =>
      (`${a.title || ''} ${a.subtitle || ''} ${blocksText(a)}`).toLowerCase().includes(t)
    )
  }

  arr.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
  const total = arr.length

  // kategoriya hisoblagichlari (filtrsiz umumiy ro'yxatdan)
  const catCount = {}
  for (const a of Object.values(store)) {
    const k = a.league || 'Futbol'
    catCount[k] = (catCount[k] || 0) + 1
  }
  const categories = Object.entries(catCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  const items = arr.slice(page * size, page * size + size).map((a) => ({
    id: a.id, slug: a.slug, title: a.title, subtitle: a.subtitle || a.excerpt || '',
    image: a.image, league: a.league, time: relTime(a.date),
    hasFull: !!a.blocks,
  }))

  return { items, total, page, size, categories }
}

export function count() {
  return Object.keys(store).length
}
