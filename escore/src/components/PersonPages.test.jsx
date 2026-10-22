import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'

vi.mock('../api.js', async importOriginal => {
  const actual = await importOriginal()
  return { ...actual, api: { coach: vi.fn(), referee: vi.fn(), img: () => null } }
})

const { api, ApiError } = await import('../api.js')
const { default: Coach } = await import('./Coach.jsx')
const { default: Referee } = await import('./Referee.jsx')

const MATCH = { id: 900, status: 'ft', hs: 1, as: 0, home: { n: 'Arsenal', id: 1 }, away: { n: 'Leeds', id: 3 } }

const makeCoach = over => ({
  id: 5,
  name: 'Mikel Arteta',
  team: 'Arsenal',
  teamId: 1,
  teamColor: '#c00000',
  flag: '🇪🇸',
  country: 'Spain',
  age: null,
  formation: '4-3-3',
  totalGames: null,
  totalTrophies: null,
  record: { games: null, w: null, d: null, l: null, ppg: null, winPct: null },
  career: [{ club: 'Arsenal', id: 1, c: '#c00000', from: null, to: null, games: null, ppg: null, trophies: null }],
  matches: [MATCH],
  meta: { unavailable: [] },
  ...over,
})

const makeReferee = over => ({
  id: 8,
  name: 'Daniele Orsato',
  flag: '🇮🇹',
  country: 'Italy',
  age: 48,
  totals: { apps: 120, yellow: 400, red: 10, pen: null },
  career: [{ id: null, flag: '🇮🇹', name: 'Umumiy karyera', apps: 120, avgYellow: null, red: 10, pen: null }],
  matches: [MATCH],
  meta: { unavailable: [] },
  ...over,
})

const rowValue = name => screen.getByRole('rowheader', { name }).nextSibling.textContent

describe('Coach sahifasi', () => {
  beforeEach(() => {
    api.coach.mockReset()
    window.history.replaceState(null, '', '/coach/5')
  })

  it('null kubok/ppg/winPct → "—"; natijalar paneli halol bo\'sh; jamoa havolasi', async () => {
    api.coach.mockResolvedValue(makeCoach())
    const { container } = render(<Coach id="5" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Mikel Arteta' })).toBeInTheDocument()
    expect(container.querySelector('.pl-hero__num')).toHaveTextContent('—')
    expect(rowValue('Jami kuboklar')).toBe('—')
    expect(rowValue("Boshqargan o'yinlar")).toBe('—')
    expect(rowValue('Yosh')).toBe('—')
    expect(screen.getByText('Joriy mavsum natijalari mavjud emas.')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/null|undefined|NaN/)
    expect(screen.getByRole('link', { name: /Arsenal/ })).toHaveAttribute('href', '/team/1')
    await waitFor(() => expect(document.title).toContain('Mikel Arteta'))
  })

  it('Karyera tabi: caption, scope, davr/kubok "—"', async () => {
    api.coach.mockResolvedValue(makeCoach())
    render(<Coach id="5" />)
    fireEvent.click(await screen.findByRole('tab', { name: 'Karyera' }))
    const table = screen.getByRole('table', { name: 'Murabbiy boshqargan klublar' })
    expect(within(table).getByRole('columnheader', { name: 'Kubok' })).toHaveAttribute('scope', 'col')
    const cells = within(table)
      .getAllByRole('cell')
      .map(c => c.textContent)
    expect(cells.slice(1)).toEqual(['—', '—', '—', '—'])
  })

  it("O'yinlar tabi MatchRow ishlatadi; meta.unavailable → .unavailable", async () => {
    api.coach.mockResolvedValueOnce(makeCoach())
    const first = render(<Coach id="5" />)
    fireEvent.click(await screen.findByRole('tab', { name: "O'yinlar" }))
    const link = screen.getByRole('link', { name: "Arsenal 1 : 0 Leeds, o'yin sahifasi" })
    expect(link).toHaveAttribute('href', '/match/900')
    expect(link.closest('.lg-match')).toHaveClass('is-linkrow')
    first.unmount()

    api.coach.mockResolvedValueOnce(makeCoach({ matches: [], meta: { unavailable: ['matches'] } }))
    render(<Coach id="5" />)
    fireEvent.click(await screen.findByRole('tab', { name: "O'yinlar" }))
    expect(screen.getByText(/O'yinlar ro'yxati yuklanmadi/)).toHaveClass('unavailable')
  })

  it("404: 'Murabbiy topilmadi' (h1), qayta urinish yo'q", async () => {
    api.coach.mockRejectedValue(new ApiError('x', { status: 404, code: 'NOT_FOUND' }))
    render(<Coach id="5" />)
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByRole('heading', { level: 1, name: 'Murabbiy topilmadi' })).toBeInTheDocument()
    expect(within(alert).queryByRole('button')).not.toBeInTheDocument()
  })

  it('xato: ErrorBox (h1) va qayta urinish', async () => {
    api.coach
      .mockRejectedValueOnce(new ApiError('x', { status: 503, code: 'UPSTREAM_UNAVAILABLE' }))
      .mockResolvedValueOnce(makeCoach())
    render(<Coach id="5" />)
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByRole('heading', { level: 1 })).toBeInTheDocument()
    fireEvent.click(within(alert).getByRole('button', { name: 'Qayta urinish' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Mikel Arteta' })).toBeInTheDocument()
  })
})

describe('Referee sahifasi', () => {
  beforeEach(() => {
    api.referee.mockReset()
    window.history.replaceState(null, '', '/referee/8')
  })

  it('null penalti/avgYellow → "—"; jadval caption/scope; uydirma son yo\'q', async () => {
    api.referee.mockResolvedValue(makeReferee())
    const { container } = render(<Referee id="8" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Daniele Orsato' })).toBeInTheDocument()
    expect(container.querySelector('.pl-hero__num')).toHaveTextContent('—')
    expect(rowValue('Jami penaltilar')).toBe('—')
    expect(rowValue("Jami o'yinlar")).toBe('120')
    const table = screen.getByRole('table', { name: "Hakam karyerasi turnirlar bo'yicha" })
    expect(within(table).getByRole('columnheader', { name: 'Penalti' })).toHaveAttribute('scope', 'col')
    const cells = within(table)
      .getAllByRole('cell')
      .map(c => c.textContent)
    expect(cells.slice(1)).toEqual(['120', '—', '10', '—'])
    expect(container.textContent).not.toMatch(/null|undefined|NaN/)
  })

  it("karyera bo'sh bo'lsa karyera sarlavhasi ham chiqmaydi", async () => {
    api.referee.mockResolvedValue(makeReferee({ career: [] }))
    render(<Referee id="8" />)
    await screen.findByRole('heading', { level: 1, name: 'Daniele Orsato' })
    expect(screen.queryByRole('heading', { name: /Karyera statistikasi/ })).not.toBeInTheDocument()
  })

  it("O'yinlar tabi MatchRow qatorlari (lg-match, havola)", async () => {
    api.referee.mockResolvedValue(makeReferee())
    render(<Referee id="8" />)
    const tab = await screen.findByRole('tab', { name: "O'yinlar" })
    fireEvent.click(tab)
    expect(tab).toHaveAttribute('aria-selected', 'true')
    const link = screen.getByRole('link', { name: "Arsenal 1 : 0 Leeds, o'yin sahifasi" })
    expect(link).toHaveAttribute('href', '/match/900')
    expect(link.closest('.lg-match')).toBeInTheDocument()
  })
})
