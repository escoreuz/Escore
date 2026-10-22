import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within, waitFor, act, configure } from '@testing-library/react'

// Birinchi render sovuq importlar bilan sekin bo'lishi mumkin
configure({ asyncUtilTimeout: 4000 })

const { mockApi, polling } = vi.hoisted(() => ({
  mockApi: {
    days: vi.fn(),
    matches: vi.fn(),
    scorers: vi.fn(),
    standingsMini: vi.fn(),
    countries: vi.fn(),
    countryLeagues: vi.fn(),
    img: vi.fn(() => null),
  },
  polling: { calls: [] },
}))

vi.mock('../api.js', async importOriginal => ({ ...(await importOriginal()), api: mockApi }))
// usePolling o'zi hooks.test.jsx da tekshirilgan (yashirin sahifada to'xtash ham) — bu yerda faqat argumentlari
vi.mock('../lib/hooks.js', async importOriginal => ({
  ...(await importOriginal()),
  usePolling: (fn, ms, opts) => polling.calls.push({ fn, ms, enabled: opts?.enabled }),
}))

// Mijozdagi boshlang'ich sana server `today` bilan bir xil bo'lsin (testlar real soatga bog'lanmasin)
vi.mock('../lib/format.js', async importOriginal => ({
  ...(await importOriginal()),
  tashkentDateKey: () => '2026-10-15',
}))

import Score from './Score.jsx'

const TODAY = '2026-10-15'
const YESTERDAY = '2026-10-14'
const DAYS = {
  today: TODAY,
  days: [
    { date: YESTERDAY, dow: 'Ch', d: '14', label: 'Chor' },
    { date: TODAY, dow: 'Pa', d: '15', label: 'Bugun' },
  ],
}
const league = { id: 17, name: 'Premier League', country: 'Angliya' }
const mk = (id, home, away, extra = {}) => ({
  id,
  status: 'sched',
  hs: null,
  as: null,
  minute: null,
  time: '20:00',
  home: { n: home, c: '#c00', id: id * 10 },
  away: { n: away, c: '#00c', id: id * 10 + 1 },
  leagueId: 17,
  league,
  ...extra,
})
const LIVE = mk(1, 'Arsenal', 'Chelsea', { status: 'live', hs: 2, as: 1, minute: 67 })
const SCHED = mk(2, 'Everton', 'Fulham')
const resp = (matches, extra = {}) => ({
  date: TODAY,
  matches,
  liveCount: matches.filter(m => m.status === 'live').length,
  partial: false,
  ...extra,
})
const lastPoll = () => polling.calls[polling.calls.length - 1]

beforeEach(() => {
  polling.calls = []
  Object.values(mockApi).forEach(fn => fn.mockReset?.())
  mockApi.img.mockReturnValue(null)
  mockApi.days.mockResolvedValue(DAYS)
  mockApi.scorers.mockResolvedValue([{ rank: 1, id: 5, name: 'Haaland', team: 'City', goals: null }])
  mockApi.standingsMini.mockResolvedValue([{ pos: 1, club: 'Arsenal', pts: null }])
  mockApi.countries.mockResolvedValue({ countries: [] })
  mockApi.matches.mockResolvedValue(resp([LIVE, SCHED]))
})

describe('Score — polling', () => {
  it('bugun: polling yoqilgan, jonli bor → 15 s, chaqiruv fresh:true', async () => {
    render(<Score />)
    await screen.findByText('Everton')
    expect(lastPoll()).toMatchObject({ enabled: true, ms: 15_000 })
    mockApi.matches.mockClear()
    await act(() => lastPoll().fn())
    expect(mockApi.matches).toHaveBeenCalledWith(
      { date: TODAY, status: 'all', q: '' },
      expect.objectContaining({ fresh: true, signal: expect.any(AbortSignal) }),
    )
  })

  it("jonli o'yin yo'q → 60 s", async () => {
    mockApi.matches.mockResolvedValue(resp([SCHED]))
    render(<Score />)
    await screen.findByText('Everton')
    expect(lastPoll()).toMatchObject({ enabled: true, ms: 60_000 })
  })

  it("o'tgan sana tanlansa polling o'chadi va eski ro'yxat ko'rinmaydi", async () => {
    render(<Score />)
    await screen.findByText('Everton')
    mockApi.matches.mockReturnValue(new Promise(() => {}))
    fireEvent.click(screen.getByRole('button', { name: /14-oktabr 2026/ }))
    expect(screen.queryByText('Everton')).not.toBeInTheDocument()
    expect(screen.getByText("O'yinlar yuklanmoqda…")).toBeInTheDocument()
    expect(lastPoll().enabled).toBe(false)
    expect(mockApi.matches).toHaveBeenLastCalledWith(
      { date: YESTERDAY, status: 'all', q: '' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })
})

describe('Score — holatlar', () => {
  it('503 → manba ishlamayapti xabari va qayta urinish', async () => {
    mockApi.matches.mockRejectedValue({ status: 503, code: 'UPSTREAM_UNAVAILABLE' })
    render(<Score />)
    expect(await screen.findByText(/Ma'lumot manbai vaqtincha ishlamayapti/)).toBeInTheDocument()
    mockApi.matches.mockResolvedValue(resp([SCHED]))
    fireEvent.click(screen.getAllByRole('button', { name: 'Qayta urinish' })[0])
    expect(await screen.findByText('Everton')).toBeInTheDocument()
  })

  it('partial:true → eslatma, oxirgi yangilanish vaqti chiqadi', async () => {
    mockApi.matches.mockResolvedValue(resp([LIVE], { partial: true }))
    render(<Score />)
    expect(await screen.findByText(/Faqat jonli o'yinlar ko'rsatilmoqda/)).toBeInTheDocument()
    expect(screen.getByText(/Oxirgi yangilanish \d\d:\d\d/)).toBeInTheDocument()
  })

  it('featured: jonli bor → blok, yo‘q → blok yo‘q', async () => {
    const { unmount } = render(<Score />)
    await screen.findByText('Everton')
    expect(screen.getByRole('heading', { name: "TANLANGAN O'YIN" })).toBeInTheDocument()
    unmount()
    mockApi.matches.mockResolvedValue(resp([SCHED]))
    render(<Score />)
    await screen.findByText('Everton')
    expect(screen.queryByRole('heading', { name: "TANLANGAN O'YIN" })).not.toBeInTheDocument()
  })

  it("bombardir goals null → '—', bitta h1", async () => {
    render(<Score />)
    const scorer = await screen.findByRole('link', { name: 'Haaland' })
    expect(scorer).toHaveAttribute('href', '/player/5')
    expect(within(scorer.closest('li')).getByText('—')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
})

describe('Score — qidiruv va a11y', () => {
  it('qidiruv 300 ms debounce bilan bitta so‘rov yuboradi', async () => {
    render(<Score />)
    await screen.findByText('Everton')
    mockApi.matches.mockClear()
    const input = screen.getByRole('searchbox', { name: 'Jamoa qidirish' })
    fireEvent.change(input, { target: { value: 'a' } })
    fireEvent.change(input, { target: { value: 'ar' } })
    fireEvent.change(input, { target: { value: 'ars' } })
    expect(mockApi.matches).not.toHaveBeenCalled()
    await waitFor(() => expect(mockApi.matches).toHaveBeenCalledTimes(1))
    expect(mockApi.matches.mock.calls[0][0]).toEqual({ date: TODAY, status: 'all', q: 'ars' })
  })

  it('qator havola orqali ochiladi, jonli holat va hisob matnli', async () => {
    render(<Score />)
    const links = await screen.findAllByRole('link', { name: "O'yin sahifasi: Arsenal 2 – 1 Chelsea" })
    const link = links.find(a => a.closest('.sc-row'))
    expect(link).toHaveAttribute('href', '/match/1')
    const row = link.closest('.sc-row')
    expect(row).toHaveClass('is-linkrow')
    expect(within(row).getByText('Jonli,')).toHaveClass('sr-only')
    expect(within(row).getByText('Arsenal 2 – 1 Chelsea')).toHaveClass('sr-only')
  })

  it('sevimli yulduz aria-pressed holatini almashtiradi', async () => {
    render(<Score />)
    const star = await screen.findByRole('button', { name: "Sevimlilarga qo'shish: Arsenal – Chelsea" })
    expect(star).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(star)
    const on = screen.getByRole('button', { name: 'Sevimlilardan olish: Arsenal – Chelsea' })
    expect(on).toHaveAttribute('aria-pressed', 'true')
  })

  it('filtr va kun tugmalari aria-pressed, bugun aria-current', async () => {
    render(<Score />)
    await screen.findByText('Everton')
    expect(screen.getByRole('group', { name: "O'yin holati bo'yicha filtr" })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hammasi' })).toHaveAttribute('aria-pressed', 'true')
    const today = screen.getByRole('button', { name: /15-oktabr 2026/ })
    expect(today).toHaveAttribute('aria-current', 'date')
    expect(today).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('Score — yuklash tartibi va davlatlar', () => {
  it("o'yinlarni /api/days ni kutmasdan darhol tashkentDateKey() sanasi bilan so'raydi", async () => {
    mockApi.days.mockReturnValue(new Promise(() => {}))
    render(<Score />)
    await waitFor(() =>
      expect(mockApi.matches).toHaveBeenCalledWith(
        { date: TODAY, status: 'all', q: '' },
        expect.objectContaining({ fresh: true }),
      ),
    )
    expect(mockApi.days).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Everton')).toBeInTheDocument()
  })

  it('CountryRow: aria-expanded, aria-controls mavjud id, hidden → ko‘rinadi, pin aria-pressed', async () => {
    mockApi.countries.mockResolvedValue({ countries: [{ id: 30, name: 'Testiya' }] })
    mockApi.countryLeagues.mockResolvedValue({ leagues: [{ id: 999, name: 'Test Liga' }] })
    render(<Score />)
    const head = await screen.findByRole('button', { name: 'Testiya' })
    expect(head).toHaveAttribute('aria-expanded', 'false')
    const panel = document.getElementById(head.getAttribute('aria-controls'))
    expect(panel).not.toBeNull()
    expect(panel).not.toBeVisible()

    fireEvent.click(head)
    expect(head).toHaveAttribute('aria-expanded', 'true')
    expect(await within(panel).findByRole('link', { name: 'Test Liga' })).toHaveAttribute('href', '/league/999')
    expect(panel).toBeVisible()
    expect(mockApi.countryLeagues).toHaveBeenCalledWith(
      30,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )

    const pin = within(panel).getByRole('button', { name: 'Test Liga ligasini mahkamlash' })
    expect(pin).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(pin)
    expect(pin).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(pin)
    expect(pin).toHaveAttribute('aria-pressed', 'false')
  })
})
