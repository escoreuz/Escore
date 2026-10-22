import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'

const state = { current: null }
vi.mock('../api.js', () => ({
  api: { league: vi.fn(() => 'league'), img: () => null },
  useApi: fn => {
    fn({})
    return state.current
  },
  isAbortError: () => false,
}))

const { api } = await import('../api.js')
const { default: League } = await import('./League.jsx')
const { standingsView } = await import('./league/standings.js')

const row = (id, name, pos, extra = {}) => ({
  id,
  pos,
  name,
  c: '#123',
  P: 5,
  Pts: 10 - pos,
  total: { w: 3, d: 1, l: 1 },
  home: { w: 2, d: 0, l: 0 },
  away: { w: 1, d: 1, l: 1 },
  GF: 8,
  GA: 4,
  GD: 4,
  form: ['G', 'D'],
  ...extra,
})

const NULL_ROW = {
  id: null,
  pos: null,
  name: 'Noma',
  P: null,
  Pts: null,
  total: { w: null, d: null, l: null },
  home: null,
  away: null,
  GF: null,
  GA: null,
  GD: null,
  form: [],
}

const DATA = {
  league: { id: '17', name: 'Premier League', country: 'Angliya', flag: '' },
  seasons: [
    { id: 1, year: '25/26' },
    { id: 2, year: '24/25' },
  ],
  currentSeasonId: 1,
  stages: null,
  teamCount: 3,
  groups: [{ name: 'Premier League', rows: [row(42, 'Arsenal', 1), row(38, 'Chelsea', 2), NULL_ROW] }],
  matches: [
    {
      id: '5',
      date: '2025-10-09',
      status: 'sched',
      ts: null,
      time: '21:00',
      hs: null,
      as: null,
      minute: null,
      home: { n: 'Arsenal', id: 42 },
      away: { n: null, id: 38 },
    },
  ],
  scorers: [{ rank: 1, id: 9, name: 'Haaland', team: 'Man City', teamId: 17, goals: null, assists: null }],
  meta: { unavailable: ['standings/home', 'scorers'] },
}

const ok = data => ({ data, loading: false, error: null, reload: vi.fn() })

describe('League sahifasi', () => {
  beforeEach(() => {
    api.league.mockClear()
    state.current = ok(DATA)
    window.history.replaceState(null, '', '/league/17')
  })

  it('bitta h1, useSeo, api.league(id, season, opts) chaqiriladi', async () => {
    render(<League id="17" />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    await waitFor(() => expect(document.title).toBe('Premier League | eSCORE'))
    expect(api.league).toHaveBeenCalledWith('17', undefined, expect.anything())
  })

  it('jadval a11y: caption, scope, abbr, lg-club__inner, region; zona/legend uydirilmaydi', () => {
    const { container } = render(<League id="17" />)
    const region = screen.getByRole('region', { name: /Premier League: jadval/ })
    expect(region).toHaveAttribute('tabindex', '0')
    const table = within(region).getByRole('table')
    expect(table.querySelector('caption')).toHaveClass('sr-only')
    expect(within(table).getAllByRole('columnheader')[0]).toHaveAttribute('scope', 'col')
    expect(within(table).getByTitle("O'yinlar")).toHaveTextContent("O'")
    const club = within(table).getByRole('rowheader', { name: /Arsenal/ })
    expect(club).toHaveAttribute('scope', 'row')
    expect(club.querySelector('.lg-club__inner')).not.toBeNull()
    expect(within(club).getByRole('link')).toHaveAttribute('href', '/team/42')
    expect(screen.queryByText(/zona|Chempionlar ligasi|Yevropa ligasi/i)).toBeNull()
    expect(container.querySelector('.lg-legend, .is-cl, .is-el, .is-rel')).toBeNull()
  })

  it("null qatorda '—', havola qurilmaydi, 'null' matni chiqmaydi", () => {
    const { container } = render(<League id="17" />)
    const noma = screen.getByRole('rowheader', { name: /Noma/ })
    expect(within(noma).queryByRole('link')).toBeNull()
    expect(within(noma.closest('tr')).getAllByText('—').length).toBeGreaterThan(5)
    expect(container.innerHTML).not.toMatch(/null|undefined|NaN/)
  })

  it("Uyda: aria-pressed, home/away null → '—' va unavailable yozuvi", () => {
    render(<League id="17" />)
    const btn = screen.getByRole('button', { name: 'Uyda' })
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Ma'lumot manbai vaqtincha ishlamayapti/)).toHaveClass('unavailable')
    const noma = screen.getByRole('rowheader', { name: /Noma/ }).closest('tr')
    expect(within(noma).getAllByText('—').length).toBeGreaterThan(5)
  })

  it("mavsum almashganda api.league(id, season) qayta so'raladi; hero, picker va fokus saqlanadi", () => {
    render(<League id="17" />)
    expect(screen.getByRole('button', { name: '25/26' })).toHaveAttribute('aria-pressed', 'true')
    const btn = screen.getByRole('button', { name: '24/25' })
    btn.focus()
    state.current = { data: null, loading: true, error: null, reload: vi.fn() }
    fireEvent.click(btn)
    expect(api.league).toHaveBeenCalledWith('17', 2, expect.anything())
    expect(btn).toBeInTheDocument()
    expect(document.activeElement).toBe(btn)
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { level: 1, name: 'Premier League' })).toBeInTheDocument()
    expect(screen.getByText('Mavsum yuklanmoqda…')).toBeInTheDocument()
  })

  it('mavsum xatosida picker qoladi, xato tab maydonida', () => {
    render(<League id="17" />)
    state.current = { data: null, loading: false, error: { code: 'UPSTREAM_UNAVAILABLE' }, reload: vi.fn() }
    fireEvent.click(screen.getByRole('button', { name: '24/25' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '25/26' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it("Tabs: O'yinlar → MatchRow havolasi, sana format.js bilan", () => {
    render(<League id="17" />)
    const tab = screen.getByRole('tab', { name: "O'yinlar" })
    fireEvent.click(tab)
    expect(tab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('link', { name: /o'yin sahifasi/ })).toHaveAttribute('href', '/match/5')
    expect(screen.getByRole('heading', { name: /9-oktabr 2025/ })).toHaveTextContent(/Payshanba/)
  })

  it("Bombardirlar: null gol '—' va unavailable yozuvi", () => {
    render(<League id="17" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Bombardirlar' }))
    expect(screen.getByRole('link', { name: 'Haaland' })).toHaveAttribute('href', '/player/9')
    expect(screen.getByText(/Ma'lumot manbai vaqtincha ishlamayapti/)).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
  })

  it('Tabs klaviatura: ArrowRight keyingi tabga o`tadi', () => {
    render(<League id="17" />)
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Jadval' }), { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: "O'yinlar" })).toHaveAttribute('aria-selected', 'true')
  })

  it('xato: level=1 ErrorBox va qayta urinish', () => {
    const reload = vi.fn()
    state.current = { data: null, loading: false, error: { code: 'UPSTREAM_UNAVAILABLE' }, reload }
    render(<League id="17" />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Qayta urinish' }))
    expect(reload).toHaveBeenCalled()
  })
})

describe('standingsView', () => {
  it("muzlatilgan massivni o'zgartirmaydi va uy jadvali bo'yicha saralaydi", () => {
    const rows = Object.freeze([
      row(1, 'A', 1, { home: { w: 0, d: 0, l: 2 } }),
      row(2, 'B', 2, { home: { w: 2, d: 0, l: 0 } }),
      NULL_ROW,
    ])
    const view = standingsView(rows, 'home')
    expect(view.map(r => r.name)).toEqual(['B', 'A', 'Noma'])
    expect(view[0]).toMatchObject({ pos: 1, Pts: 6, P: 2, GD: null })
    expect(view[2].pos).toBeNull()
    expect(rows[0].name).toBe('A')
  })
})
