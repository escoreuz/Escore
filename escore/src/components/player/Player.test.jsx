import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'

vi.mock('../../api.js', async importOriginal => {
  const actual = await importOriginal()
  return {
    ...actual,
    api: { player: vi.fn(), playerCareer: vi.fn(), playerSeason: vi.fn(), feed: vi.fn(), img: () => null },
  }
})

const { api, ApiError } = await import('../../api.js')
const { default: Player } = await import('../Player.jsx')

const upstream = () => new ApiError('x', { status: 503, code: 'UPSTREAM_UNAVAILABLE' })

const recentMatch = over => ({
  id: 77,
  status: 'ft',
  hs: 2,
  as: 1,
  date: '2026-10-01',
  home: { n: 'Arsenal', id: 1 },
  away: { n: 'Chelsea', id: 2 },
  league: { name: 'Premier League', flag: '🏴' },
  ...over,
})

const makePlayer = over => ({
  id: 10,
  name: 'Bukayo Saka',
  team: 'Arsenal',
  teamId: 1,
  teamColor: '#c00000',
  posLabel: 'Hujumchi',
  rating: null,
  base: { country: 'England', flag: '🏴', birth: null, age: null, height: null, foot: null, number: 7 },
  attrs: [],
  strengths: [],
  weaknesses: [],
  monthly: [],
  seasonsList: [{ tid: 17, sid: 61627, name: 'Premier League', year: '25/26' }],
  recent: [{ m: recentMatch(), result: 'G', rating: null }],
  meta: { unavailable: [] },
  ...over,
})

const renderPlayer = async () => {
  const view = render(<Player id="10" />)
  await screen.findByRole('heading', { level: 1, name: 'Bukayo Saka' })
  return view
}

describe('Player sahifasi', () => {
  beforeEach(() => {
    for (const fn of [api.player, api.playerCareer, api.playerSeason, api.feed]) fn.mockReset()
    window.history.replaceState(null, '', '/player/10')
  })

  it("bo'sh attrs: radar va kuchli/zaif bloklari yo'q, reyting \"—\", 'null' ko'rinmaydi", async () => {
    api.player.mockResolvedValue(makePlayer())
    const { container } = await renderPlayer()
    expect(container.querySelector('.pl-radar')).toBeNull()
    expect(screen.queryByText('Kuchli tomonlari')).not.toBeInTheDocument()
    expect(screen.getByText("Xususiyatlar bo'yicha ma'lumot yo'q.")).toBeInTheDocument()
    expect(container.querySelector('.pl-rating__num')).toHaveTextContent('—')
    expect(container.textContent).not.toMatch(/null|undefined|NaN/)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    await waitFor(() => expect(document.title).toContain('Bukayo Saka'))
    expect(api.player).toHaveBeenCalledWith('10', expect.objectContaining({ signal: expect.anything() }))
  })

  it("attrs bor: radar (role=img) va kuchli tomonlar; val null bo'lgan o'q tashlanadi", async () => {
    const attrs = [
      { label: 'Hujum', val: 80 },
      { label: 'Texnika', val: 70 },
      { label: 'Taktika', val: 60 },
      { label: 'Himoya', val: null },
    ]
    api.player.mockResolvedValue(makePlayer({ attrs, strengths: ['Hujum'], weaknesses: ['Taktika'] }))
    await renderPlayer()
    const radar = screen.getByRole('img', { name: /Xususiyatlar: Hujum 80, Texnika 70, Taktika 60$/ })
    expect(radar).toHaveClass('pl-radar')
    expect(screen.getByText('Kuchli tomonlari')).toBeInTheDocument()
    expect(screen.getByText('Hujum', { selector: '.pl-tag' })).toHaveClass('is-strong')
  })

  it("o'yin qatori: is-linkrow + stretched-link havola, reyting yo'q → \"—\" va inline rang yo'q", async () => {
    api.player.mockResolvedValue(makePlayer())
    await renderPlayer()
    const link = screen.getByRole('link', { name: "Arsenal 2 : 1 Chelsea, o'yin sahifasi" })
    expect(link).toHaveAttribute('href', '/match/77')
    expect(link).toHaveClass('plm-score', 'stretched-link')
    const row = link.closest('li')
    expect(row).toHaveClass('plm-row', 'is-linkrow')
    const rating = row.querySelector('.plm-rating')
    expect(rating).toHaveTextContent('—')
    expect(rating.getAttribute('style')).toBeNull()
  })

  it("ID'siz o'yin: havola qurilmaydi; meta.unavailable → .unavailable yozuvlari", async () => {
    api.player.mockResolvedValueOnce(makePlayer({ recent: [{ m: recentMatch({ id: null }) }] }))
    const first = await renderPlayer()
    expect(screen.queryByRole('link', { name: /o'yin sahifasi/ })).not.toBeInTheDocument()
    first.unmount()

    api.player.mockResolvedValueOnce(makePlayer({ meta: { unavailable: ['recent', 'attrs', 'monthly'] } }))
    const { container } = await renderPlayer()
    const notes = [...container.querySelectorAll('.unavailable')].map(n => n.textContent)
    expect(notes).toEqual([
      expect.stringMatching(/Xususiyatlar ma'lumoti yuklanmadi/),
      expect.stringMatching(/Oylik reyting yuklanmadi/),
      expect.stringMatching(/So'nggi o'yinlar yuklanmadi/),
    ])
  })

  it('Tabs: Karera tabi tanlanadi; partial/truncated eslatmalari va jadval caption/scope', async () => {
    api.player.mockResolvedValue(makePlayer())
    api.playerCareer.mockResolvedValue({
      isGK: false,
      rows: [
        {
          year: '25/26',
          tournament: 'Premier League',
          teamId: 1,
          mp: 8,
          min: 650,
          goals: 3,
          assists: null,
          rating: '7.10',
        },
      ],
      partial: true,
      failedSeasons: [{ tid: 7, sid: 1, tournament: 'UCL', year: '24/25' }],
      truncated: true,
    })
    await renderPlayer()
    expect(screen.getByRole('tablist', { name: "O'yinchi bo'limlari" })).toBeInTheDocument()
    const tab = screen.getByRole('tab', { name: 'Karera' })
    fireEvent.click(tab)
    expect(tab).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText(/Ba'zi mavsumlar yuklanmadi: UCL 24\/25/)).toHaveClass('unavailable')
    expect(screen.getByText("Faqat so'nggi mavsumlar ko'rsatilgan.")).toHaveClass('unavailable')
    const table = screen.getByRole('table', { name: /O'yinchi karerasi/ })
    expect(within(table).getByRole('columnheader', { name: 'Reyting' })).toHaveAttribute('scope', 'col')
    const cells = within(table)
      .getAllByRole('cell')
      .map(c => c.textContent)
    expect(cells).toEqual(['25/26', 'Premier League', '8', '650', '3', '—', '7.10'])
    expect(within(table).getByText('7.10')).toHaveStyle({ color: 'rgb(255, 255, 255)' })
  })

  it('Mavsum tabi: select label\'i, ⚽ aria-hidden, tasma havolasi, heatmap unavailable, null → "—"', async () => {
    api.player.mockResolvedValue(makePlayer())
    api.playerSeason.mockResolvedValue({
      summary: {
        isGK: false,
        appearances: 5,
        started: 4,
        minutesPerGame: 80,
        totalMinutes: 400,
        goals: null,
        assists: 1,
        rating: '6.80',
      },
      heatmap: [],
      timeline: [{ date: '2026-09-01', matchId: '55', oppName: null, oppId: null, rating: '6.80' }],
      meta: { unavailable: ['heatmap'] },
    })
    await renderPlayer()
    fireEvent.click(screen.getByRole('tab', { name: 'Mavsum' }))
    expect(screen.getByRole('combobox', { name: 'Turnir va mavsum' })).toHaveClass('pls-select')
    const tl = await screen.findByRole('link', { name: /Raqib bilan o'yin, 01\.09, reyting 6\.80/ })
    expect(tl).toHaveAttribute('href', '/match/55')
    expect(tl.querySelector('.pls-mtl__noopp')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText(/Issiqlik xaritasi yuklanmadi/)).toHaveClass('unavailable')
    expect(screen.getByRole('rowheader', { name: 'Gollar' }).nextSibling).toHaveTextContent('—')
    expect(api.playerSeason).toHaveBeenCalledWith(10, 17, 61627, expect.anything())
  })

  it("sahifa xatosi: h1 li ErrorBox, 'Qayta urinish' qayta yuklaydi", async () => {
    api.player.mockRejectedValueOnce(upstream()).mockResolvedValueOnce(makePlayer())
    render(<Player id="10" />)
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(alert).toHaveTextContent(/manbai vaqtincha ishlamayapti/)
    fireEvent.click(within(alert).getByRole('button', { name: 'Qayta urinish' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Bukayo Saka' })).toBeInTheDocument()
    expect(api.player).toHaveBeenCalledTimes(2)
  })

  it("404: 'O'yinchi topilmadi' (h1), qayta urinish tugmasi yo'q", async () => {
    api.player.mockRejectedValue(new ApiError('x', { status: 404, code: 'NOT_FOUND' }))
    render(<Player id="10" />)
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByRole('heading', { level: 1, name: "O'yinchi topilmadi" })).toBeInTheDocument()
    expect(within(alert).queryByRole('button')).not.toBeInTheDocument()
  })

  it('mavsum tez almashsa eski javob ko`rinmaydi; tab almashganda tanlov saqlanadi', async () => {
    const seasonsList = [
      { tid: 17, sid: 1, name: 'Premier League', year: '25/26' },
      { tid: 7, sid: 2, name: 'Champions League', year: '25/26' },
    ]
    const summary = appearances => ({ isGK: false, appearances, goals: 1, rating: '7.00' })
    let resolveFirst
    api.player.mockResolvedValue(makePlayer({ seasonsList }))
    api.playerCareer.mockResolvedValue({ rows: [] })
    api.playerSeason
      .mockImplementationOnce(() => new Promise(res => (resolveFirst = res)))
      .mockResolvedValue({ summary: summary(9), heatmap: [], timeline: [], meta: { unavailable: [] } })
    await renderPlayer()
    fireEvent.click(screen.getByRole('tab', { name: 'Mavsum' }))
    // 1-mavsum so'rovi haqiqatan boshlangach (javobi hali kelmagan) mavsum almashtiriladi
    await waitFor(() => expect(api.playerSeason).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByRole('combobox', { name: 'Turnir va mavsum' }), { target: { value: '1' } })
    await waitFor(() =>
      expect(screen.getByRole('rowheader', { name: 'Ishtiroklar' }).nextSibling).toHaveTextContent('9'),
    )
    resolveFirst({ summary: summary(5), heatmap: [], timeline: [], meta: { unavailable: [] } })
    await new Promise(r => setTimeout(r, 0))
    expect(screen.getByRole('rowheader', { name: 'Ishtiroklar' }).nextSibling).toHaveTextContent('9')

    fireEvent.click(screen.getByRole('tab', { name: 'Karera' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Mavsum' }))
    expect(screen.getByRole('combobox', { name: 'Turnir va mavsum' })).toHaveValue('1')
    expect(api.playerSeason).toHaveBeenLastCalledWith(10, 7, 2, expect.anything())
  })

  it('Yangiliklar tabi xatosi qayta urinish bilan; topilgan xabar Link orqali', async () => {
    api.player.mockResolvedValue(makePlayer())
    api.feed
      .mockRejectedValueOnce(upstream())
      .mockResolvedValueOnce({ items: [{ id: 1, slug: 'saka-gol', title: 'Saka gol urdi', image: '/s.jpg' }] })
    await renderPlayer()
    fireEvent.click(screen.getByRole('tab', { name: 'Yangiliklar' }))
    const alert = await screen.findByRole('alert')
    fireEvent.click(within(alert).getByRole('button', { name: 'Qayta urinish' }))
    const link = await screen.findByRole('link', { name: 'Saka gol urdi' })
    expect(link).toHaveAttribute('href', '/news/saka-gol')
    expect(screen.getByAltText('Saka gol urdi')).toHaveAttribute('loading', 'lazy')
  })
})
