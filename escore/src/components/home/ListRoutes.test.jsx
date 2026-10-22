import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const state = { current: null }
vi.mock('../../api.js', () => ({
  api: { news: vi.fn(), search: vi.fn() },
  useApi: () => state.current,
}))
// ListPage — 2-to'lqin (T-10) fayli; bu yerda faqat marshrut mantiqi tekshiriladi
vi.mock('../ListPage.jsx', () => ({
  default: ({ title, articles }) => (
    <section>
      <h1>{title}</h1>
      <p>{articles.length} ta</p>
    </section>
  ),
}))

const { SectionPage, SearchPage } = await import('./ListRoutes.jsx')
const robots = () => document.head.querySelector('meta[name="robots"]')

describe('SectionPage', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    state.current = {
      data: [
        { slug: 'a', section: 'TRANSFER' },
        { slug: 'b', section: 'TAHLIL' },
      ],
      loading: false,
      error: null,
      reload: vi.fn(),
    }
  })

  it("oq ro'yxatdagi bo'lim maqolalarini filtrlaydi va indekslanadi", async () => {
    render(<SectionPage section="TRANSFER" />)
    expect(screen.getByRole('heading', { level: 1, name: 'TRANSFER' })).toBeInTheDocument()
    expect(screen.getByText('1 ta')).toBeInTheDocument()
    await waitFor(() => expect(document.title).toBe('TRANSFER | eSCORE'))
    expect(robots()).toBeNull()
  })

  it("noma'lum bo'lim → 404 sahifa va noindex", async () => {
    render(<SectionPage section="UYDIRMA BO'LIM" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Sahifa topilmadi' })).toBeInTheDocument()
    await waitFor(() => expect(robots()).toHaveAttribute('content', 'noindex, follow'))
  })

  it('xato bo`lsa ErrorBox h1 sarlavha bilan', () => {
    state.current = { data: null, loading: false, error: { code: 'NETWORK' }, reload: vi.fn() }
    render(<SectionPage section="TAHLIL" />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
})

describe('SearchPage', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
  })

  it('natijalarni ko`rsatadi va noindex qo`yadi', async () => {
    state.current = { data: { articles: [{ slug: 'x' }] }, loading: false, error: null, reload: vi.fn() }
    render(<SearchPage query="Messi" />)
    expect(screen.getByRole('heading', { level: 1, name: '«Messi»' })).toBeInTheDocument()
    await waitFor(() => expect(robots()).toHaveAttribute('content', 'noindex, follow'))
  })

  it('xato bo`lsa ErrorBox h1 sarlavha bilan', () => {
    state.current = { data: null, loading: false, error: { code: 'NETWORK' }, reload: vi.fn() }
    render(<SearchPage query="x" />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })
})

describe("bo'limlar oq ro'yxati", () => {
  it("store'dagi MUXBIR USTUNI bo'limi ochiladi (404 emas)", () => {
    state.current = { data: [{ slug: 'm', section: 'MUXBIR USTUNI' }], loading: false, error: null, reload: vi.fn() }
    render(<SectionPage section="MUXBIR USTUNI" />)
    expect(screen.getByRole('heading', { level: 1, name: 'MUXBIR USTUNI' })).toBeInTheDocument()
  })
})

describe("default bo'lim", () => {
  it("store default 'YANGILIK' bo'limi ochiladi (404 emas)", () => {
    state.current = { data: [{ slug: 'y', section: 'YANGILIK' }], loading: false, error: null, reload: vi.fn() }
    render(<SectionPage section="YANGILIK" />)
    expect(screen.getByRole('heading', { level: 1, name: 'YANGILIK' })).toBeInTheDocument()
    expect(screen.queryByText('Sahifa topilmadi')).toBeNull()
  })
})
