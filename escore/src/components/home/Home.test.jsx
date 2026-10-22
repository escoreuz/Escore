import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const state = { current: null }
vi.mock('../../api.js', () => ({
  api: { home: vi.fn() },
  useApi: () => state.current,
}))

const { default: Home, PARTIAL_TEXT } = await import('./Home.jsx')

const HOME = {
  lead: { slug: 'lead', href: '/news/lead', title: 'Bosh xabar', kicker: 'LIGA', image: '/l.jpg', body: ['a', 'b'] },
  secondary: [{ slug: 's1', title: 'Ikkinchi xabar', image: '/s1.jpg' }],
  quote: { text: 'Futbol — hayot', author: 'Muallif' },
  ticker: ['Lenta xabari'],
  briefs: ['Qisqa 1'],
  standings: [
    { pos: 1, club: 'Arsenal', p: 5, w: 4, d: 1, l: 0, pts: 13 },
    { pos: 5, club: 'Chelsea', p: 5, w: 2, d: 1, l: 2, pts: 7 },
  ],
  results: [],
  fixtures: [],
  meta: { source: 'store', unavailable: ['results'] },
}

describe('Home', () => {
  beforeEach(() => {
    state.current = { data: HOME, loading: false, error: null, reload: vi.fn() }
    window.history.replaceState(null, '', '/')
  })

  it('bitta sr-only h1 va useSeo sarlavhasi', async () => {
    render(<Home />)
    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toHaveClass('sr-only')
    await waitFor(() => expect(document.title).toContain('| eSCORE'))
  })

  it('lead rasmi fetchpriority=high va lazy emas; boshqa rasmlar lazy; alt=sarlavha; rasm-havola takrori yashirin', () => {
    render(<Home />)
    const lead = screen.getByAltText('Bosh xabar')
    expect(lead).toHaveAttribute('fetchpriority', 'high')
    expect(lead).not.toHaveAttribute('loading')
    expect(lead.closest('a')).toHaveAttribute('tabindex', '-1')
    expect(lead.closest('a')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByAltText('Ikkinchi xabar')).toHaveAttribute('loading', 'lazy')
    expect(screen.getByRole('link', { name: 'Bosh xabar' })).toHaveAttribute('href', '/news/lead')
  })

  it('jadval: caption, th scope, table-scroll, top-4 zona matnda', () => {
    render(<Home />)
    const table = screen.getByRole('table')
    expect(table.querySelector('caption')).toHaveClass('sr-only')
    expect(table.querySelectorAll('th[scope="col"]')).toHaveLength(7)
    expect(table.closest('.table-scroll')).not.toBeNull()
    expect(screen.getByText(/Chempionlar Ligasi zonasi$/, { selector: '.sr-only' })).toBeInTheDocument()
    expect(screen.getAllByText(/Chempionlar Ligasi zonasi/, { selector: '.sr-only' })).toHaveLength(1)
  })

  it("meta.unavailable bo'limida .unavailable yozuvi; bo'sh (manba ishlayotgan) bo'lim yashirinadi", () => {
    render(<Home />)
    expect(screen.getByRole('heading', { name: "SO'NGGI NATIJALAR" })).toBeInTheDocument()
    expect(screen.getByText("Ma'lumot manbai vaqtincha ishlamayapti")).toHaveClass('unavailable')
    expect(screen.queryByRole('heading', { name: "BUGUNGI O'YINLAR" })).toBeNull()
  })

  it('xato bo`lsa ErrorBox va qayta urinish reload ni chaqiradi', () => {
    const reload = vi.fn()
    state.current = { data: null, loading: false, error: { code: 'UPSTREAM_UNAVAILABLE' }, reload }
    render(<Home />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Qayta urinish/ }))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('yuklanishda Loading holati', () => {
    state.current = { data: null, loading: true, error: null, reload: vi.fn() }
    render(<Home />)
    expect(screen.getByRole('status')).toHaveTextContent('Bosh sahifa yuklanmoqda')
  })

  it("meta.partial === true bo'lsa qisqa .unavailable eslatma; aks holda yo'q", () => {
    const { unmount } = render(<Home />)
    expect(screen.queryByText(PARTIAL_TEXT)).toBeNull()
    unmount()
    state.current = { ...state.current, data: { ...HOME, meta: { ...HOME.meta, partial: true } } }
    render(<Home />)
    expect(screen.getByText(PARTIAL_TEXT)).toHaveClass('unavailable')
  })

  it("null maydonlar '—' bo'ladi: jadval, natija, fikstura vaqti; pos null → top-zona yo'q", () => {
    state.current = {
      ...state.current,
      data: {
        ...HOME,
        meta: { source: 'live', unavailable: [] },
        standings: [{ pos: null, club: null, p: null, w: null, d: null, l: null, pts: null }],
        results: [{ home: null, away: 'B', hs: null, as: null }],
        fixtures: [{ home: 'A', away: null, ts: null, time: null }],
      },
    }
    const { container } = render(<Home />)
    expect(container.textContent).not.toMatch(/null|undefined/)
    const row = screen.getByRole('table').querySelector('tbody tr')
    expect(row).not.toHaveClass('is-top')
    expect([...row.querySelectorAll('td')].every(td => td.textContent === '—')).toBe(true)
    expect(container.querySelector('.fixtures__time')).toHaveTextContent('—')
    expect(container.querySelector('.fixtures__match')).toHaveTextContent('A — —')
    expect(container.querySelector('.results__team--h')).toHaveTextContent('—')
  })
})
