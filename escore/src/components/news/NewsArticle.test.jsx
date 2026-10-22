import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { mockApi } = vi.hoisted(() => ({
  mockApi: { base: 'https://api.test', newsArticle: vi.fn(), article: vi.fn(), news: vi.fn() },
}))
vi.mock('../../api.js', async importOriginal => ({ ...(await importOriginal()), api: mockApi }))

import { ApiError } from '../../api.js'
import NewsArticle from '../NewsArticle.jsx'
import Article from '../Article.jsx'
import ListPage from '../ListPage.jsx'
import AdSlot from '../AdSlot.jsx'
import { telegramShareUrl } from './ShareBar.jsx'
import { isoDate } from './articleSeo.js'

const NEWS = {
  slug: 'messi-gol',
  title: 'Messi & Co: yangi gol',
  excerpt: 'Qisqacha mazmun',
  image: 'https://img.test/messi.jpg',
  author: 'J. Doe',
  league: 'MLS',
  date: '2026-10-14T10:00:00Z',
  time: '1 kun oldin',
  blocks: [
    { type: 'p', text: 'Birinchi xatboshi' },
    { type: 'h', text: 'Kichik sarlavha' },
  ],
  sourceUrl: 'https://www.sofascore.com/news/messi',
  translationComplete: true,
}

const jsonLd = () => JSON.parse(document.getElementById('seo-jsonld')?.textContent || 'null')
const meta = sel => document.head.querySelector(sel)?.getAttribute('content')

describe('NewsArticle', () => {
  beforeEach(() => mockApi.newsArticle.mockReset())
  // navigator.clipboard testda qo'shiladi — keyingi testlarga oqib o'tmasin
  afterEach(() => {
    delete navigator.clipboard
  })

  it('useSeo: type article, description, og:image va NewsArticle JSON-LD', async () => {
    mockApi.newsArticle.mockResolvedValueOnce(NEWS)
    render(<NewsArticle slug="messi-gol" />)
    await screen.findByRole('heading', { level: 1, name: NEWS.title })

    await waitFor(() => expect(document.title).toBe(`${NEWS.title} | eSCORE`))
    expect(meta('meta[property="og:type"]')).toBe('article')
    expect(meta('meta[name="description"]')).toBe('Qisqacha mazmun')
    expect(meta('meta[property="og:image"]')).toBe(NEWS.image)
    const ld = jsonLd()
    expect(ld).toMatchObject({
      '@type': 'NewsArticle',
      headline: NEWS.title,
      image: [NEWS.image],
      datePublished: '2026-10-14T10:00:00.000Z',
      author: { '@type': 'Person', name: 'J. Doe' },
      publisher: { name: 'eSCORE', logo: { url: expect.stringMatching(/\/icon-512\.png$/) } },
      inLanguage: 'uz',
    })
    expect(document.querySelectorAll('h1')).toHaveLength(1)
    const img = screen.getByRole('img', { name: NEWS.title })
    expect(img).toHaveAttribute('fetchpriority', 'high')
    expect(screen.getByRole('link', { name: 'SofaScore' })).toHaveAttribute('href', NEWS.sourceUrl)
    expect(screen.queryByText(/Avtomatik tarjima to'liq emas/)).not.toBeInTheDocument()
  })

  it("javascript: sourceUrl va xavfsiz bo'lmagan rasm chiqarilmaydi", async () => {
    mockApi.newsArticle.mockResolvedValueOnce({ ...NEWS, sourceUrl: 'javascript:alert(1)', image: 'data:x' })
    const { container } = render(<NewsArticle slug="messi-gol" />)
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('link', { name: 'SofaScore' })).not.toBeInTheDocument()
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText(/Manba:/)).toHaveTextContent('SofaScore')
  })

  it("translationComplete=false bo'lsa eslatma chiqadi", async () => {
    mockApi.newsArticle.mockResolvedValueOnce({ ...NEWS, translationComplete: false })
    render(<NewsArticle slug="messi-gol" />)
    expect(await screen.findByText(/Avtomatik tarjima to'liq emas/)).toBeInTheDocument()
  })

  it("share-bar: Telegram URL backend OG sahifasini to'g'ri kodlaydi, nusxalash natijasi e'lon qilinadi", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    mockApi.newsArticle.mockResolvedValueOnce(NEWS)
    render(<NewsArticle slug="messi-gol" />)
    await screen.findByRole('heading', { level: 1 })

    const share = 'https://api.test/share/news/messi-gol'
    const tg = screen.getByRole('link', { name: /Telegram/ })
    expect(tg).toHaveAttribute(
      'href',
      `https://t.me/share/url?url=${encodeURIComponent(share)}&text=${encodeURIComponent(NEWS.title)}`,
    )
    expect(tg.getAttribute('href')).toContain('text=Messi%20%26%20Co%3A')
    expect(tg).toHaveAttribute('rel', 'noopener noreferrer')
    fireEvent.click(screen.getByRole('button', { name: 'Havolani nusxalash' }))
    await waitFor(() => expect(screen.getByText('Havola nusxalandi')).toHaveAttribute('role', 'status'))
    expect(writeText).toHaveBeenCalledWith(share)
  })

  it('NOT_FOUND → 404 sahifa (noindex); 503 → ErrorBox + qayta urinish', async () => {
    mockApi.newsArticle.mockRejectedValueOnce(new ApiError('x', { status: 404, code: 'NOT_FOUND' }))
    const { unmount } = render(<NewsArticle slug="yoq" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Sahifa topilmadi' })).toBeInTheDocument()
    await waitFor(() => expect(meta('meta[name="robots"]')).toBe('noindex, follow'))
    unmount()

    mockApi.newsArticle
      .mockRejectedValueOnce(new ApiError('x', { status: 503, code: 'UPSTREAM_UNAVAILABLE' }))
      .mockResolvedValueOnce(NEWS)
    render(<NewsArticle slug="messi-gol" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('vaqtincha ishlamayapti')
    fireEvent.click(screen.getByRole('button', { name: 'Qayta urinish' }))
    expect(await screen.findByRole('heading', { level: 1, name: NEWS.title })).toBeInTheDocument()
  })
})

describe('Article (store maqolasi)', () => {
  const STORE = {
    slug: 'tarix',
    title: 'Tarixiy yakun',
    standfirst: 'Kirish',
    author: 'A. Rahimov',
    date: '23-iyun, 2026',
    tags: ['final', 'kubok'],
    body: null,
  }
  beforeEach(() => {
    mockApi.article.mockReset()
    mockApi.news.mockReset().mockResolvedValue([STORE, { slug: 'boshqa', title: 'Boshqa maqola' }])
  })

  it('teglar havola emas, body=null yiqitmaydi, share-bar canonical /article URL, JSON-LD article', async () => {
    mockApi.article.mockResolvedValueOnce(STORE)
    const { container } = render(<Article slug="tarix" />)
    await screen.findByRole('heading', { level: 1, name: 'Tarixiy yakun' })

    const tag = screen.getByText('#final')
    expect(tag.tagName).toBe('SPAN')
    expect(tag.closest('a')).toBeNull()
    expect(container.querySelector('a[href="#"]')).toBeNull()
    const tg = screen.getByRole('link', { name: /Telegram/ })
    expect(decodeURIComponent(tg.getAttribute('href'))).toContain(`${window.location.origin}/article/tarix`)
    await waitFor(() => expect(meta('meta[property="og:type"]')).toBe('article'))
    expect(jsonLd()).toMatchObject({ '@type': 'NewsArticle', headline: 'Tarixiy yakun' })
    expect(jsonLd().datePublished).toBeUndefined()
    expect(await screen.findByRole('link', { name: 'Boshqa maqola' })).toHaveAttribute('href', '/article/boshqa')
  })

  it("tarmoq xatosi '404 topilmadi' deb ko'rsatilmaydi", async () => {
    mockApi.article.mockRejectedValueOnce(new ApiError('x', { status: 0, code: 'NETWORK' }))
    render(<Article slug="tarix" />)
    expect(await screen.findByRole('alert')).toHaveTextContent("Server bilan aloqa yo'q")
    expect(screen.queryByText('Sahifa topilmadi')).not.toBeInTheDocument()
  })
})

describe('ListPage, AdSlot va yordamchilar', () => {
  afterEach(() => vi.restoreAllMocks())

  it("ListPage: null maydonlar '—', rasm yo'q bo'lsa <img> yo'q, havola History yo'li", () => {
    const { container } = render(
      <ListPage eyebrow="BO'LIM" title="LaLiga" articles={[{ slug: 'a b', title: 'Sarlavha', author: null }]} />,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByRole('link', { name: 'Sarlavha' })).toHaveAttribute('href', '/article/a%20b')
    expect(container.textContent).not.toMatch(/null|undefined/)
    expect(container.querySelectorAll('h1')).toHaveLength(1)
  })

  it('ListPage: articles berilmasa ham yiqilmaydi', () => {
    render(<ListPage eyebrow="X" title="Y" />)
    expect(screen.getByText(/Hech narsa topilmadi/)).toBeInTheDocument()
  })

  it('AdSlot: javascript: havola chiqarilmaydi, xavfsiz havola sponsored, aria-label Reklama', () => {
    const { container, rerender } = render(<AdSlot img="/banner.jpg" href="javascript:alert(1)" />)
    expect(screen.getByText('Reklama')).toHaveClass('sr-only')
    expect(container.querySelector('aside')).toBeNull()
    expect(container.querySelector('a')).toBeNull()
    rerender(<AdSlot img="/banner.jpg" href="https://ads.test/x" />)
    expect(container.querySelector('a')).toHaveAttribute('rel', 'noopener noreferrer sponsored')
    rerender(<AdSlot img="javascript:alert(1)" />)
    expect(container.querySelector('img')).toBeNull()
  })

  it('telegramShareUrl va isoDate chegaraviy holatlari', () => {
    expect(telegramShareUrl('https://x.test/a?b=1', '')).toBe(
      'https://t.me/share/url?url=https%3A%2F%2Fx.test%2Fa%3Fb%3D1&text=',
    )
    expect(isoDate('23-iyun, 2026')).toBeUndefined()
    expect(isoDate(null)).toBeUndefined()
    expect(isoDate(1760436000)).toBe(new Date(1760436000 * 1000).toISOString())
  })
})
