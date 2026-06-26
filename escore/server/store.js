// Yangiliklar ombori — JSON faylda saqlanadi (CRUD). Birinchi ishga tushishda
// frontenddagi ARTICLES bilan urug'lanadi.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ARTICLES } from '../src/data/news.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'db')
const FILE = join(DATA_DIR, 'news.json')

function load() {
  if (!existsSync(FILE)) {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
    writeFileSync(FILE, JSON.stringify(ARTICLES, null, 2), 'utf8')
    return structuredClone(ARTICLES)
  }
  return JSON.parse(readFileSync(FILE, 'utf8'))
}

let articles = load()

function persist() {
  writeFileSync(FILE, JSON.stringify(articles, null, 2), 'utf8')
}

export function listArticles() {
  // ro'yxat uchun yengil ko'rinish (body siz)
  return articles.map(({ body, ...rest }) => rest)
}
export function getArticle(slug) {
  return articles.find((a) => a.slug === slug) || null
}
export function createArticle(data) {
  if (!data.slug || !data.title) throw new Error('slug va title majburiy')
  if (articles.some((a) => a.slug === data.slug)) throw new Error('Bunday slug mavjud')
  const article = {
    slug: data.slug,
    section: data.section || 'YANGILIK',
    kicker: data.kicker || data.section || 'YANGILIK',
    title: data.title,
    standfirst: data.standfirst || '',
    author: data.author || 'eSOCRE',
    date: data.date || new Date().toISOString().slice(0, 10),
    readTime: data.readTime || '3 daqiqa o\'qish',
    photoTag: data.photoTag || 'FOTO · eSOCRE',
    caption: data.caption || '',
    body: Array.isArray(data.body) ? data.body : (data.body ? [data.body] : []),
  }
  articles.unshift(article)
  persist()
  return article
}
export function updateArticle(slug, data) {
  const i = articles.findIndex((a) => a.slug === slug)
  if (i === -1) return null
  articles[i] = { ...articles[i], ...data, slug }
  persist()
  return articles[i]
}
export function deleteArticle(slug) {
  const i = articles.findIndex((a) => a.slug === slug)
  if (i === -1) return false
  articles.splice(i, 1)
  persist()
  return true
}
export function searchArticles(q) {
  const term = (q || '').toLowerCase()
  if (!term) return []
  return articles
    .filter((a) =>
      (a.title + ' ' + a.standfirst + ' ' + a.section + ' ' + (a.body || []).join(' '))
        .toLowerCase()
        .includes(term)
    )
    .map(({ body, ...rest }) => rest)
}
// Bosh sahifa bloklari (lead/secondary/columns) joriy ombordan
export function homeBlocks() {
  return {
    lead: articles[0],
    secondary: articles.slice(1, 4),
    columns: articles.slice(4, 7),
  }
}
