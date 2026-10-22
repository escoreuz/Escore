// 2-urinish (react-reviewer) topilmalari: sahifalash chegaralari, poyga, slug, hero fallback, ShareBar, AdSlot
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

const { mockApi } = vi.hoisted(() => ({
  mockApi: { base: 'https://api.test', archive: vi.fn(), newsArticle: vi.fn(), article: vi.fn(), news: vi.fn() },
}))
vi.mock('../../api.js', async importOriginal => ({ ...(await importOriginal()), api: mockApi }))

import { ApiError } from '../../api.js'
import Archive from '../Archive.jsx'
import NewsArticle from '../NewsArticle.jsx'
import Article from '../Article.jsx'
import ListPage from '../ListPage.jsx'
import AdSlot from '../AdSlot.jsx'
import ShareBar, { COPY_FAIL, COPY_OK, STATUS_CLEAR_MS } from './ShareBar.jsx'
import NewsCard from './NewsCard.jsx'
import { isValidSlug } from './paths.js'

const item = slug => ({ slug, title: `Sarlavha ${slug}`, image: null })
const page = (items, { hasMore = false, total = items.length } = {}) => ({
  items,
  total,
  page: 0,
  size: 2,
  hasMore,
  categories: [{ name: 'LaLiga', count: 1 }],
})
const deferred = () => {
  let resolve
  const promise = new Promise(r => (resolve = r))
  return { promise, resolve }
}
const NEWS = { slug: 'messi-gol', title: 'Messi gol', image: 'https://img.test/m.jpg', blocks: [] }

describe('Archive — sahifalash chegaralari', () => {
  beforeEach(() => mockApi.archive.mockReset())

  it('keyingi sahifa xatosida yuklangan elementlar saqlanadi, retry davom ettiradi va fokus yangi kartochkaga', async () => {
    mockApi.archive
      .mockResolvedValueOnce(page([item('a'), item('b')], { hasMore: true, total: 3 }))
      .mockRejectedValueOnce(new ApiError('x', { status: 503, code: 'UPSTREAM_UNAVAILABLE' }))
      .mockResolvedValueOnce(page([item('c')], { total: 3 }))
    render(<Archive />)
    await screen.findByText('Sarlavha a')
    fireEvent.click(screen.getByRole('button', { name: 'Yana yuklash' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Keyingi sahifani yuklab bo'lmadi")
    expect(screen.getByText('Sarlavha a')).toBeInTheDocument()
    expect(screen.getByText('Sarlavha b')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Qayta urinish' }))

    const fresh = await screen.findByRole('link', { name: 'Sarlavha c' })
    expect(mockApi.archive.mock.calls.at(-1)[0]).toEqual({ q: '', category: '', page: 1 })
    await waitFor(() => expect(fresh).toHaveFocus())
  })

  it("filtr javobdan oldin o'zgarsa kechikkan eski javob ko'rsatilmaydi (poyga)", async () => {
    const slow = deferred()
    mockApi.archive
      .mockResolvedValueOnce(page([item('a')]))
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce(page([item('z')]))
    render(<Archive />)
    await screen.findByText('Sarlavha a')
    fireEvent.click(screen.getByRole('button', { name: /LaLiga/ }))
    // eski (LaLiga) so'rovi haqiqatan yuborilgach filtr yana o'zgaradi
    await waitFor(() => expect(mockApi.archive).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: 'Hammasi' }))
    expect(await screen.findByText('Sarlavha z')).toBeInTheDocument()

    await act(async () => slow.resolve(page([item('x')])))
    expect(screen.queryByText('Sarlavha x')).not.toBeInTheDocument()
    expect(screen.getByText('Sarlavha z')).toBeInTheDocument()
  })

  it("sahifalar birlashganda takror slug va slug'siz element tashlanadi", async () => {
    mockApi.archive
      .mockResolvedValueOnce(page([item('a'), item('b')], { hasMore: true, total: 3 }))
      .mockResolvedValueOnce(page([item('b'), { title: 'Slugsiz' }, item('c')]))
    const { container } = render(<Archive />)
    await screen.findByText('Sarlavha a')
    fireEvent.click(screen.getByRole('button', { name: 'Yana yuklash' }))
    await screen.findByText('Sarlavha c')
    expect(container.querySelectorAll('article.nw-card')).toHaveLength(3)
    expect(screen.queryByText('Slugsiz')).not.toBeInTheDocument()
  })

  it('yuklanish paytida tugma aria-disabled va takroriy bosish yangi so‘rov yubormaydi', async () => {
    const slow = deferred()
    mockApi.archive
      .mockResolvedValueOnce(page([item('a')], { hasMore: true, total: 2 }))
      .mockReturnValueOnce(slow.promise)
    render(<Archive />)
    await screen.findByText('Sarlavha a')
    fireEvent.click(screen.getByRole('button', { name: 'Yana yuklash' }))
    const busy = await screen.findByRole('button', { name: 'Yuklanmoqda…' })
    expect(busy).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(busy)
    expect(mockApi.archive).toHaveBeenCalledTimes(2)
    await act(async () => slow.resolve(page([item('b')])))
  })
})

describe('maqola sahifalari — slug va holatlar', () => {
  beforeEach(() => {
    mockApi.newsArticle.mockReset()
    mockApi.article.mockReset()
    mockApi.news.mockReset().mockResolvedValue([])
  })

  it("yaroqsiz slug so'rovsiz 404 (noindex)", async () => {
    render(<NewsArticle slug="../etc passwd" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Sahifa topilmadi' })).toBeInTheDocument()
    render(<Article slug={'x'.repeat(161)} />)
    expect(mockApi.newsArticle).not.toHaveBeenCalled()
    expect(mockApi.article).not.toHaveBeenCalled()
    expect(isValidSlug('ok-slug-1')).toBe(true)
    expect(isValidSlug('')).toBe(false)
  })

  it('BAD_REQUEST javobi ham 404 sahifa sifatida', async () => {
    mockApi.article.mockRejectedValueOnce(new ApiError('x', { status: 400, code: 'BAD_REQUEST' }))
    render(<Article slug="tarix" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Sahifa topilmadi' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it("yuklanish paytida sarlavha 'Yuklanmoqda' va noindex", async () => {
    mockApi.newsArticle.mockReturnValueOnce(new Promise(() => {}))
    render(<NewsArticle slug="messi-gol" />)
    await waitFor(() => expect(document.title).toBe('Yuklanmoqda | eSCORE'))
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, follow')
  })

  it('hero rasm yuklanmasa figure ichida fallback span qolmaydi (NewsArticle va Article)', async () => {
    mockApi.newsArticle.mockResolvedValueOnce(NEWS)
    const { container, unmount } = render(<NewsArticle slug="messi-gol" />)
    fireEvent.error(await screen.findByRole('img', { name: 'Messi gol' }))
    await waitFor(() => expect(container.querySelector('img')).toBeNull())
    expect(container.querySelector('.nw-card__noimg')).toBeNull()
    unmount()

    mockApi.article.mockResolvedValueOnce({ slug: 'tarix', title: 'Tarix', image: 'https://img.test/t.jpg' })
    const view = render(<Article slug="tarix" />)
    fireEvent.error(await screen.findByRole('img', { name: 'Tarix' }))
    await waitFor(() => expect(view.container.querySelector('figure img')).toBeNull())
    expect(view.container.querySelector('.nw-card__noimg')).toBeNull()
  })

  it("o'xshash maqolalarda bo'sh title/kicker/standfirst 'undefined' yoki bo'sh <p> bermaydi", async () => {
    mockApi.article.mockResolvedValueOnce({ slug: 'tarix', title: 'Tarix' })
    mockApi.news.mockReset().mockResolvedValue([{ slug: 'boshqa' }])
    const { container } = render(<Article slug="tarix" />)
    expect(await screen.findByRole('link', { name: 'Sarlavhasiz maqola' })).toHaveAttribute('href', '/article/boshqa')
    expect(container.querySelector('.columns__item p')).toBeNull()
    expect(container.textContent).not.toMatch(/undefined|null/)
  })
})

describe('ShareBar', () => {
  afterEach(() => {
    delete navigator.clipboard
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('clipboard xatosida aniq holat xabari, xato log qilinadi', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    })
    render(<ShareBar url="https://x.test/a" title="T" />)
    fireEvent.click(screen.getByRole('button', { name: 'Havolani nusxalash' }))
    expect(await screen.findByText(COPY_FAIL)).toHaveAttribute('role', 'status')
    expect(warn).toHaveBeenCalled()
  })

  it("clipboard API yo'q bo'lsa ham xato xabari", async () => {
    render(<ShareBar url="https://x.test/a" title="T" />)
    fireEvent.click(screen.getByRole('button', { name: 'Havolani nusxalash' }))
    expect(await screen.findByText(COPY_FAIL)).toBeInTheDocument()
  })

  it('holat xabari STATUS_CLEAR_MS dan keyin tozalanadi', async () => {
    vi.useFakeTimers()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
    render(<ShareBar url="https://x.test/a" title="T" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Havolani nusxalash' })))
    expect(screen.getByRole('status')).toHaveTextContent(COPY_OK)
    act(() => vi.advanceTimersByTime(STATUS_CLEAR_MS))
    expect(screen.getByRole('status')).toHaveTextContent('')
  })
})

describe('ListPage, NewsCard, AdSlot', () => {
  it('ListPage kartochka sarlavhasi h2 (h1 dan keyin daraja sakramaydi)', () => {
    render(<ListPage eyebrow="X" title="Y" articles={[{ slug: 'a', title: 'Birinchi' }]} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Birinchi' })).toBeInTheDocument()
  })

  it("NewsCard liga yorlig'i ekran o'quvchiga meta qismida ham beriladi", () => {
    const { container } = render(<NewsCard item={{ slug: 'a', title: 'T', league: 'LaLiga' }} />)
    expect(container.querySelector('.nw-card__meta .sr-only')).toHaveTextContent('Liga: LaLiga')
  })

  it("AdSlot: '/\\\\host' va '//host' rasm yo'llari rad etiladi, '/banner.jpg' qabul qilinadi", () => {
    const { container, rerender } = render(<AdSlot img={'/\\evil.test/x.png'} />)
    expect(container.querySelector('img')).toBeNull()
    rerender(<AdSlot img="//evil.test/x.png" />)
    expect(container.querySelector('img')).toBeNull()
    rerender(<AdSlot img="/banner.jpg" />)
    expect(container.querySelector('img')).toHaveAttribute('src', '/banner.jpg')
    expect(container.querySelector('aside')).toBeNull()
  })
})
