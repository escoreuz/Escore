import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { mockApi } = vi.hoisted(() => ({ mockApi: { base: 'https://api.test', archive: vi.fn(), feed: vi.fn() } }))
vi.mock('../../api.js', async importOriginal => ({ ...(await importOriginal()), api: mockApi }))

import { ApiError } from '../../api.js'
import Archive from '../Archive.jsx'
import News from '../News.jsx'

const item = (slug, extra = {}) => ({
  slug,
  title: `Sarlavha ${slug}`,
  image: `https://img.test/${slug}.jpg`,
  ...extra,
})
const pageOf = (slugs, { page = 0, total = 3, hasMore = false } = {}) => ({
  items: slugs.map(s => item(s)),
  total,
  page,
  size: 2,
  hasMore,
  categories: [{ name: 'LaLiga', count: 2 }],
})

describe('Archive', () => {
  beforeEach(() => {
    mockApi.archive.mockReset()
  })

  it("'Yana yuklash' sahifalarni birlashtiradi va hasMore=false bo'lganda yo'qoladi", async () => {
    mockApi.archive
      .mockResolvedValueOnce(pageOf(['a', 'b'], { hasMore: true }))
      .mockResolvedValueOnce(pageOf(['c'], { page: 1, hasMore: false }))
    render(<Archive />)

    expect(await screen.findByText('Sarlavha a')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Yana yuklash' }))

    expect(await screen.findByText('Sarlavha c')).toBeInTheDocument()
    expect(screen.getByText('Sarlavha a')).toBeInTheDocument()
    expect(screen.getByText('Sarlavha b')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Yana yuklash' })).not.toBeInTheDocument()
    expect(mockApi.archive.mock.calls[1][0]).toEqual({ q: '', category: '', page: 1 })
    expect(screen.getByText("3 ta maqola topildi, 3 tasi ko'rsatilmoqda")).toHaveAttribute('role', 'status')
  })

  it("kategoriya o'zgarsa birinchi sahifadan (page 0) yuklaydi va aria-pressed yangilanadi", async () => {
    mockApi.archive
      .mockResolvedValueOnce(pageOf(['a', 'b'], { hasMore: true }))
      .mockResolvedValueOnce(pageOf(['c'], { page: 1, hasMore: true }))
      .mockResolvedValueOnce(pageOf(['x'], { total: 1 }))
    render(<Archive />)
    await screen.findByText('Sarlavha a')
    fireEvent.click(screen.getByRole('button', { name: 'Yana yuklash' }))
    await screen.findByText('Sarlavha c')

    const cat = screen.getByRole('button', { name: /LaLiga/ })
    fireEvent.click(cat)

    expect(await screen.findByText('Sarlavha x')).toBeInTheDocument()
    expect(mockApi.archive.mock.calls.at(-1)[0]).toEqual({ q: '', category: 'LaLiga', page: 0 })
    expect(screen.queryByText('Sarlavha a')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /LaLiga/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Hammasi' })).toHaveAttribute('aria-pressed', 'false')
  })

  it("qidiruv debounce bilan page 0 dan so'raladi va topilmasa 'topilmadi' (arxiv bo'sh emas) deydi", async () => {
    mockApi.archive.mockResolvedValueOnce(pageOf(['a'])).mockResolvedValueOnce(pageOf([], { total: 0 }))
    render(<Archive />)
    await screen.findByText('Sarlavha a')
    fireEvent.change(screen.getByRole('searchbox', { name: 'Arxivdan qidirish' }), { target: { value: ' messi ' } })

    expect(await screen.findByText("“messi” bo'yicha maqola topilmadi.")).toBeInTheDocument()
    expect(mockApi.archive.mock.calls.at(-1)[0]).toEqual({ q: 'messi', category: '', page: 0 })
    expect(screen.queryByText(/Arxiv hozircha bo'sh/)).not.toBeInTheDocument()
  })

  it("xato yutilmaydi: ErrorBox + 'Qayta urinish' qayta yuklaydi", async () => {
    mockApi.archive
      .mockRejectedValueOnce(new ApiError('x', { status: 503, code: 'UPSTREAM_UNAVAILABLE' }))
      .mockResolvedValueOnce(pageOf(['a']))
    render(<Archive />)

    expect(await screen.findByRole('alert')).toHaveTextContent('vaqtincha ishlamayapti')
    expect(screen.queryByText(/Arxiv hozircha bo'sh/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Qayta urinish' }))
    expect(await screen.findByText('Sarlavha a')).toBeInTheDocument()
  })

  it("haqiqatan bo'sh arxivda 'Arxiv hozircha bo'sh' ko'rsatiladi", async () => {
    mockApi.archive.mockResolvedValueOnce({ items: [], total: 0, page: 0, size: 24, hasMore: false, categories: [] })
    render(<Archive />)
    expect(await screen.findByText(/Arxiv hozircha bo'sh/)).toBeInTheDocument()
  })
})

describe('News lentasi', () => {
  beforeEach(() => mockApi.feed.mockReset())

  it("rasm yo'q yoki xavfsiz emas bo'lsa buzilgan <img> o'rniga fallback, rasm-havola fokusdan yashirilgan", async () => {
    mockApi.feed.mockResolvedValueOnce({
      items: [item('lead', { image: null }), item('two', { image: 'javascript:alert(1)' }), item('three')],
    })
    const { container } = render(<News />)
    await screen.findByText('Sarlavha lead')

    expect(screen.getAllByTestId('news-image-fallback')).toHaveLength(2)
    const imgs = container.querySelectorAll('img.nw-card__img')
    expect(imgs).toHaveLength(1)
    expect(imgs[0]).toHaveAttribute('loading', 'lazy')
    expect(imgs[0]).toHaveAttribute('alt', 'Sarlavha three')
    expect(imgs[0]).toHaveAttribute('width')
    const media = container.querySelectorAll('a.nw-card__media')
    media.forEach(a => {
      expect(a).toHaveAttribute('tabindex', '-1')
      expect(a).toHaveAttribute('aria-hidden', 'true')
    })
    expect(screen.getByRole('link', { name: 'Sarlavha three' })).toHaveAttribute('href', '/news/three')
    expect(container.querySelectorAll('h1')).toHaveLength(1)
  })

  it('yuklanmagan rasm (onError) fallback ga almashadi', async () => {
    mockApi.feed.mockResolvedValueOnce({ items: [item('lead')] })
    const { container } = render(<News />)
    await screen.findByText('Sarlavha lead')
    fireEvent.error(container.querySelector('img.nw-card__img'))
    await waitFor(() => expect(screen.getByTestId('news-image-fallback')).toBeInTheDocument())
  })

  it('xato → ErrorBox + qayta urinish, h1 saqlanadi', async () => {
    mockApi.feed
      .mockRejectedValueOnce(new ApiError('x', { status: 503, code: 'UPSTREAM_UNAVAILABLE' }))
      .mockResolvedValueOnce({ items: [item('a')] })
    render(<News />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Futbol yangiliklari')
    fireEvent.click(screen.getByRole('button', { name: 'Qayta urinish' }))
    expect(await screen.findByText('Sarlavha a')).toBeInTheDocument()
  })
})
