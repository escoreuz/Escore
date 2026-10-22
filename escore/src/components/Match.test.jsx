import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react'

// useApi mock: fn({}) chaqirilganda api.* sentinel qaytaradi ('match' | 'league') → shu kalit bo'yicha holat
const states = {}
vi.mock('../api.js', () => ({
  api: { match: vi.fn(), league: vi.fn(), img: () => null },
  useApi: fn => states[fn({})],
  isAbortError: e => e?.name === 'AbortError',
}))

const { api } = await import('../api.js')
const { default: Match, shouldPoll, nextPollBoundary } = await import('./Match.jsx')
const { LIVE_POLL_MS } = await import('./score/matchText.js')
const { statShare, votePct, heroStatus, sportsEventJsonLd } = await import('./match/matchModel.js')

const row = (id, name, pos) => ({
  id,
  pos,
  name,
  c: '#123',
  P: 5,
  Pts: 10,
  total: { w: 3, d: 1, l: 1 },
  home: null,
  away: null,
  GF: 8,
  GA: 4,
  GD: 4,
  form: [],
})

const LEAGUE = {
  league: { id: '17', name: 'Premier League', country: 'Angliya' },
  groups: [{ name: 'Premier League', rows: [row(42, 'Arsenal', 1), row(99, 'Liverpool', 2), row(38, 'Chelsea', 3)] }],
  meta: { unavailable: [] },
}

const detail = (over = {}) => ({
  match: {
    id: '11',
    status: 'ft',
    minute: null,
    hs: 2,
    as: 1,
    ts: 1760000000,
    date: '2025-10-09',
    leagueId: '17',
    home: { n: 'Arsenal', c: '#ffff00', id: 42 },
    away: { n: 'Chelsea', c: '#000080', id: 38 },
    ...over.match,
  },
  league: { id: '17', name: 'Premier League', country: 'Angliya' },
  played: true,
  events: [
    { min: 10, team: 'home', type: 'goal', player: 'Saka', assist: null },
    { min: 50, team: 'away', type: 'yellow', player: 'Caicedo' },
    { min: 80, team: 'away', type: 'red', player: 'James' },
  ],
  stats: [
    { label: "To'p nazorati, %", home: '60', away: '40' },
    { label: 'Zarbalar', home: 'abc', away: null },
  ],
  vote: { home: 50, draw: 20, away: 30 },
  momentum: [20, -40, 60],
  lineups: {
    home: { formation: '4-3-3', lines: [4, 3, 3], players: [{ id: 7, n: 7, name: 'Saka', pos: 'HJ' }] },
    away: { formation: '', lines: [], players: [{ id: null, n: 1, name: 'Sanchez', pos: 'DG' }] },
  },
  venue: null,
  referee: null,
  refereeId: null,
  meta: { unavailable: [] },
  ...over.root,
})

const setMatch = data => {
  states.match = { data, loading: false, error: null, reload: vi.fn() }
}
const openTab = name => fireEvent.click(screen.getByRole('tab', { name }))
const liveDetail = minute => detail({ match: { status: 'live', minute } })

describe('Match sahifasi', () => {
  beforeEach(() => {
    api.match.mockReset()
    api.league.mockReset()
    api.match.mockImplementation((id, o) => (o?.fresh ? Promise.resolve(detail()) : 'match'))
    api.league.mockReturnValue('league')
    states.league = { data: LEAGUE, loading: false, error: null, reload: vi.fn() }
    setMatch(detail())
    window.history.replaceState(null, '', '/match/11')
  })
  afterEach(() => vi.useRealTimers())

  it('bitta h1, useSeo sarlavhasi va JSON-LD SportsEvent', async () => {
    render(<Match id="11" />)
    const h1 = screen.getAllByRole('heading', { level: 1 })
    expect(h1).toHaveLength(1)
    expect(h1[0]).toHaveTextContent('Arsenal – Chelsea')
    await waitFor(() => expect(document.title).toBe('Arsenal – Chelsea | eSCORE'))
    const ld = JSON.parse(document.getElementById('seo-jsonld').textContent)
    expect(ld['@type']).toBe('SportsEvent')
    expect(ld.homeTeam.name).toBe('Arsenal')
    expect(ld.awayTeam.name).toBe('Chelsea')
    expect(ld.startDate).toBe(new Date(1760000000 * 1000).toISOString())
    expect(ld.eventStatus).toBe('https://schema.org/EventScheduled')
  })

  it("Jadval tabi haqiqiy liga ma'lumotini so'raydi (demo emas), zona taxmin qilinmaydi", () => {
    render(<Match id="11" />)
    openTab('Jadval')
    expect(api.league).toHaveBeenCalledWith('17', undefined, expect.anything())
    const table = screen.getByRole('table', { name: 'Premier League' })
    expect(
      within(table)
        .getByRole('rowheader', { name: /Arsenal/ })
        .closest('tr'),
    ).toHaveClass('tm-row-hl')
    expect(
      within(table)
        .getByRole('rowheader', { name: /Liverpool/ })
        .closest('tr'),
    ).not.toHaveClass('tm-row-hl')
    expect(within(table).queryByText(/zona/i)).toBeNull()
  })

  it("liga ID yo'q bo'lsa Jadval tabi ko'rsatilmaydi", () => {
    setMatch(detail({ match: { leagueId: null }, root: { league: { id: null, name: null } } }))
    render(<Match id="11" />)
    expect(screen.queryByRole('tab', { name: 'Jadval' })).toBeNull()
    expect(screen.getAllByRole('tab')).toHaveLength(3)
  })

  it("vote null bo'lsa ovoz bloki yo'q", () => {
    setMatch(detail({ root: { vote: null } }))
    render(<Match id="11" />)
    expect(screen.queryByText('Kim yutadi?')).toBeNull()
  })

  it('kontrast: sariq fon ustida qora, to`q ko`k ustida oq matn', () => {
    render(<Match id="11" />)
    expect(screen.getByText('50%')).toHaveStyle({ color: 'rgb(0, 0, 0)' })
    expect(screen.getByText('30%')).toHaveStyle({ color: 'rgb(255, 255, 255)' })
  })

  it('statistika: NaN kenglik yo`q, null qiymat "—"', () => {
    const { container } = render(<Match id="11" />)
    openTab('Statistika')
    expect(container.innerHTML).not.toMatch(/NaN|null|undefined/)
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(container.querySelectorAll('.mp-stat__bar')).toHaveLength(1)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('voqea emojilari aria-hidden, sr-only matn bilan; momentum role=img', () => {
    render(<Match id="11" />)
    expect(screen.getByText('Gol:', { exact: false })).toHaveClass('sr-only')
    expect(screen.getByText('Sariq kartochka:', { exact: false })).toHaveClass('sr-only')
    expect(screen.getByText('Qizil kartochka:', { exact: false })).toHaveClass('sr-only')
    expect(screen.getByText('⚽')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('img', { name: /Hujum momentumi/ })).toBeInTheDocument()
  })

  it("bo'sh momentum (xatosiz) — sarlavha chiqmaydi", () => {
    setMatch(detail({ root: { momentum: [] } }))
    render(<Match id="11" />)
    expect(screen.queryByText('Hujum momentumi')).toBeNull()
  })

  it("tarkib qatori: is-linkrow + stretched-link; ID yo'q o'yinchi havolasiz; maydon role=img + kontrast", () => {
    render(<Match id="11" />)
    openTab('Tarkiblar')
    const link = screen.getByRole('link', { name: 'Saka' })
    expect(link).toHaveAttribute('href', '/player/7')
    expect(link).toHaveClass('stretched-link')
    expect(link.closest('li')).toHaveClass('is-linkrow')
    expect(screen.queryByRole('link', { name: 'Sanchez' })).toBeNull()
    const pitch = screen.getByRole('img', { name: /Maydondagi tarkiblar/ })
    expect(pitch.querySelector('.mp-dot--home')).toHaveStyle({ color: 'rgb(0, 0, 0)' })
  })

  it("meta.unavailable bo'limi uchun yozuv", () => {
    setMatch(detail({ root: { events: [], momentum: [], meta: { unavailable: ['events', 'momentum'] } } }))
    render(<Match id="11" />)
    expect(screen.getAllByText("Ma'lumot manbai vaqtincha ishlamayapti")).toHaveLength(2)
  })

  it("jonli o'yin: LIVE_POLL_MS da fresh:true bilan yangilanadi", async () => {
    vi.useFakeTimers()
    setMatch(liveDetail(55))
    api.match.mockImplementation((id, o) => (o?.fresh ? Promise.resolve(liveDetail(67)) : 'match'))
    render(<Match id="11" />)
    expect(screen.getByText("55'")).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(LIVE_POLL_MS)
    })
    expect(api.match).toHaveBeenCalledWith('11', expect.objectContaining({ fresh: true }))
    expect(screen.getByText("67'")).toBeInTheDocument()
  })

  it("polling xatosi ko'rsatiladi, oxirgi ma'lumot saqlanadi", async () => {
    vi.useFakeTimers()
    setMatch(liveDetail(55))
    api.match.mockImplementation((id, o) => (o?.fresh ? Promise.reject({ code: 'UPSTREAM_UNAVAILABLE' }) : 'match'))
    render(<Match id="11" />)
    await act(async () => {
      vi.advanceTimersByTime(LIVE_POLL_MS)
    })
    expect(screen.getByText(/Jonli yangilab bo'lmadi/)).toHaveClass('sc-status', 'is-error')
    expect(screen.getByText("55'")).toBeInTheDocument()
  })

  it("unmountda davom etayotgan so'rov bekor qilinadi", async () => {
    vi.useFakeTimers()
    setMatch(liveDetail(55))
    let signal
    api.match.mockImplementation((id, o) => {
      if (!o?.fresh) return 'match'
      signal = o.signal
      return new Promise(() => {})
    })
    const { unmount } = render(<Match id="11" />)
    await act(async () => {
      vi.advanceTimersByTime(LIVE_POLL_MS)
    })
    expect(signal.aborted).toBe(false)
    unmount()
    expect(signal.aborted).toBe(true)
  })

  it("rejadagi o'yin: qayta rendersiz ham 15 daqiqa chegarasida polling boshlanadi", async () => {
    vi.useFakeTimers()
    const now = Date.UTC(2026, 9, 22, 12, 0, 0)
    vi.setSystemTime(now)
    setMatch(detail({ match: { status: 'sched', hs: null, as: null, ts: now / 1000 + 20 * 60 } }))
    render(<Match id="11" />)
    await act(async () => {
      vi.advanceTimersByTime(4 * 60_000)
    })
    expect(api.match).not.toHaveBeenCalledWith('11', expect.objectContaining({ fresh: true }))
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    await act(async () => {
      vi.advanceTimersByTime(LIVE_POLL_MS)
    })
    expect(api.match).toHaveBeenCalledWith('11', expect.objectContaining({ fresh: true }))
  })

  it("juda uzoq kelajakdagi o'yin: taymer chegaralanadi, polling yo'q", async () => {
    vi.useFakeTimers()
    const now = Date.UTC(2026, 9, 22, 12, 0, 0)
    vi.setSystemTime(now)
    setMatch(detail({ match: { status: 'sched', ts: now / 1000 + 365 * 24 * 3600 } }))
    render(<Match id="11" />)
    await act(async () => {
      vi.advanceTimersByTime(LIVE_POLL_MS * 4)
    })
    expect(api.match).not.toHaveBeenCalledWith('11', expect.objectContaining({ fresh: true }))
  })

  it("tugagan o'yinda polling yo'q", async () => {
    vi.useFakeTimers()
    render(<Match id="11" />)
    await act(async () => {
      vi.advanceTimersByTime(LIVE_POLL_MS * 2)
    })
    expect(api.match).not.toHaveBeenCalledWith('11', expect.objectContaining({ fresh: true }))
  })

  it('xato: level=1 ErrorBox va qayta urinish', () => {
    const reload = vi.fn()
    states.match = { data: null, loading: false, error: { code: 'UPSTREAM_UNAVAILABLE' }, reload }
    render(<Match id="11" />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Qayta urinish' }))
    expect(reload).toHaveBeenCalled()
  })
})

describe('matchModel va shouldPoll', () => {
  it('shouldPoll: jonli, 15 daqiqa ichida boshlanadigan; uzoq va tugagan — yo`q', () => {
    const now = 1_000_000_000_000
    const at = minutes => (now + minutes * 60_000) / 1000
    expect(shouldPoll({ status: 'live' }, now)).toBe(true)
    expect(shouldPoll({ status: 'sched', ts: at(10) }, now)).toBe(true)
    expect(shouldPoll({ status: 'sched', ts: at(30) }, now)).toBe(false)
    expect(shouldPoll({ status: 'sched', ts: at(-60) }, now)).toBe(true)
    expect(shouldPoll({ status: 'sched', ts: at(-300) }, now)).toBe(false)
    expect(shouldPoll({ status: 'ft', ts: at(0) }, now)).toBe(false)
    expect(shouldPoll(undefined, now)).toBe(false)
  })

  it('nextPollBoundary: oyna ochilishi, yopilishi va tashqarisi', () => {
    const now = 1_000_000_000_000
    const ts = (now + 60 * 60_000) / 1000
    expect(nextPollBoundary({ status: 'sched', ts }, now)).toBe(now + 45 * 60_000)
    expect(nextPollBoundary({ status: 'sched', ts }, now + 50 * 60_000)).toBe(ts * 1000 + 3 * 3600_000 + 1)
    expect(nextPollBoundary({ status: 'sched', ts }, ts * 1000 + 4 * 3600_000)).toBeNull()
    expect(nextPollBoundary({ status: 'live', ts }, now)).toBeNull()
    expect(nextPollBoundary({ status: 'sched', ts: null }, now)).toBeNull()
  })

  it('statShare: yaroqsiz → null, 0/0 → 0, odatiy ulush', () => {
    expect(statShare('abc', 2)).toBeNull()
    expect(statShare(null, 2)).toBeNull()
    expect(statShare(0, 0)).toEqual({ home: 0, away: 0 })
    expect(statShare('60', '40')).toEqual({ home: 60, away: 40 })
  })

  it('votePct: null/NaN → null, chegaralanadi', () => {
    expect(votePct(null)).toBeNull()
    expect(votePct({ home: 'x', draw: 1, away: 1 })).toBeNull()
    expect(votePct({ home: 120, draw: -5, away: 30 })).toEqual({ home: 100, draw: 0, away: 30 })
  })

  it('heroStatus: yangi holatlar va null daqiqa', () => {
    expect(heroStatus({ status: 'canceled' })).toBe('BEKOR QILINDI')
    expect(heroStatus({ status: 'postponed' })).toBe('KECHIKTIRILDI')
    expect(heroStatus({ status: 'live', minute: null })).toBe('JONLI')
    expect(heroStatus({ status: null, time: null })).toBe('—')
  })

  it('sportsEventJsonLd: bekor qilingan o`yin, null nom qo`shilmaydi', () => {
    const ld = sportsEventJsonLd({ match: { status: 'canceled', home: { n: null }, away: { n: 'B' } } })
    expect(ld.eventStatus).toBe('https://schema.org/EventCancelled')
    expect(ld.homeTeam).toBeUndefined()
    expect(ld.startDate).toBeUndefined()
  })
})
