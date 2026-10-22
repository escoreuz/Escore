import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'

// useApi mock: fn({}) → api.* sentinel ('team' | 'league') → holat
const states = {}
vi.mock('../api.js', () => ({
  api: { team: vi.fn(() => 'team'), league: vi.fn(() => 'league'), img: () => null },
  useApi: fn => states[fn({})],
  isAbortError: () => false,
}))

const { api } = await import('../api.js')
const { default: Team } = await import('./Team.jsx')
const { default: FormBadge, FormList } = await import('./FormBadge.jsx')

const TEAM = {
  id: 42,
  name: 'Arsenal',
  color: '#c00',
  country: 'Angliya',
  standing: null,
  leagueId: '17',
  league: { flag: '', name: 'Premier League' },
  info: { stadium: 'Emirates', city: null, coach: 'Arteta', coachId: 5, founded: null },
  form: ['G', 'D', 'M'],
  squad: [
    {
      label: 'Hujumchilar',
      players: [
        { id: 7, n: 7, flag: '', name: 'Saka', pos: 'HJ', age: 23 },
        { id: null, n: '', flag: '', name: 'Noma', pos: 'HJ', age: null },
      ],
    },
  ],
  matches: [
    {
      id: '5',
      status: 'ft',
      hs: null,
      as: null,
      minute: null,
      date: '2025-10-09',
      home: { n: 'Arsenal', id: 42 },
      away: { n: null, id: 38 },
    },
  ],
  meta: { unavailable: ['matches/next'] },
}

const LEAGUE = {
  league: { id: '17', name: 'Premier League' },
  groups: [
    {
      name: 'Premier League',
      rows: [{ id: 42, pos: 1, name: 'Arsenal', P: 1, Pts: 3, total: { w: 1, d: 0, l: 0 }, GF: 1, GA: 0, GD: 1 }],
    },
  ],
  meta: { unavailable: [] },
}

const setTeam = data => {
  states.team = { data, loading: false, error: null, reload: vi.fn() }
}

describe('Team sahifasi', () => {
  beforeEach(() => {
    api.league.mockClear()
    setTeam(TEAM)
    states.league = { data: LEAGUE, loading: false, error: null, reload: vi.fn() }
    window.history.replaceState(null, '', '/team/42')
  })

  it('bitta h1, useSeo, liga havolasi va forma sr-only matni', async () => {
    const { container } = render(<Team id="42" />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    await waitFor(() => expect(document.title).toBe('Arsenal | eSCORE'))
    expect(screen.getAllByRole('link', { name: 'Premier League' })[0]).toHaveAttribute('href', '/league/17')
    expect(screen.getByText("G'alaba")).toHaveClass('sr-only')
    expect(screen.getByText("Mag'lubiyat")).toHaveClass('sr-only')
    expect(screen.getByRole('link', { name: /Arteta/ })).toHaveAttribute('href', '/coach/5')
    expect(container.innerHTML).not.toMatch(/null|undefined|NaN/)
  })

  it("Tarkib: o'yinchi qatori Link (stretched-link, is-linkrow), ID yo'q bo'lsa havolasiz, yosh null → '—'", () => {
    render(<Team id="42" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Tarkib' }))
    const link = screen.getByRole('link', { name: 'Saka' })
    expect(link).toHaveAttribute('href', '/player/7')
    expect(link).toHaveClass('stretched-link')
    expect(link.closest('li')).toHaveClass('is-linkrow')
    const noma = screen.getByText('Noma').closest('li')
    expect(within(noma).queryByRole('link')).toBeNull()
    expect(within(noma).getAllByText('—').length).toBeGreaterThan(0)
  })

  it("O'yinlar: MatchRow, null hisob/nom '—', unavailable yozuvi", () => {
    const { container } = render(<Team id="42" />)
    fireEvent.click(screen.getByRole('tab', { name: "O'yinlar" }))
    expect(screen.getByRole('link', { name: /o'yin sahifasi/ })).toHaveAttribute('href', '/match/5')
    expect(screen.getByText(/Ma'lumot manbai vaqtincha ishlamayapti/)).toHaveClass('unavailable')
    expect(container.innerHTML).not.toMatch(/null/)
  })

  it("Jadval tabi haqiqiy liga jadvalini so'raydi va jamoani ajratadi", () => {
    render(<Team id="42" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Jadval' }))
    expect(api.league).toHaveBeenCalledWith('17', undefined, expect.anything())
    expect(screen.getByRole('rowheader', { name: /Arsenal/ }).closest('tr')).toHaveClass('tm-row-hl')
  })

  it("leagueId null: Jadval tabi yo'q, liga nomi havolasiz", () => {
    setTeam({ ...TEAM, leagueId: null, league: { flag: '', name: null } })
    render(<Team id="42" />)
    expect(screen.queryByRole('tab', { name: 'Jadval' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Turnir' })).toBeNull()
    expect(screen.getAllByText('Turnir').length).toBeGreaterThan(0)
  })

  it('NOT_FOUND: "Jamoa topilmadi" h1, qayta urinish yo`q', () => {
    states.team = { data: null, loading: false, error: { code: 'NOT_FOUND' }, reload: vi.fn() }
    render(<Team id="42" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Jamoa topilmadi' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Qayta urinish' })).toBeNull()
  })
})

describe('FormBadge', () => {
  it("harf ko'rinadi (aria-hidden), to'liq so'z sr-only", () => {
    render(<FormBadge r="D" />)
    expect(screen.getByText('D')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('Durang')).toHaveClass('sr-only')
    expect(screen.getByText('Durang').parentElement).toHaveClass('lg-form', 'is-d')
  })

  it("noma'lum harf chizilmaydi; bo'sh forma '—'", () => {
    const { container } = render(<FormBadge r="X" />)
    expect(container).toBeEmptyDOMElement()
    render(<FormList form={[]} />)
    expect(screen.getByText('—')).toHaveClass('lg-forms')
  })
})
