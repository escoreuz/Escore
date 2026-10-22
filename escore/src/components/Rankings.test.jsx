import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

vi.mock('../api.js', async importOriginal => {
  const actual = await importOriginal()
  return { ...actual, api: { rankings: vi.fn(), img: () => null } }
})

const { api, ApiError } = await import('../api.js')
const { default: Rankings, isKnownKind } = await import('./Rankings.jsx')

const ROWS = [
  { rank: 1, name: 'Spain', teamId: 4, points: 1880 },
  { rank: null, name: 'Narnia', teamId: null, points: null },
]

describe('Rankings', () => {
  beforeEach(() => {
    api.rankings.mockReset()
    window.history.replaceState(null, '', '/rankings/fifa')
  })

  it('jadval: sr-only caption, th scope, table-scroll region, null → "—"', async () => {
    api.rankings.mockResolvedValue({ rows: ROWS })
    render(<Rankings kind="fifa" />)
    const table = await screen.findByRole('table', { name: /FIFA reytingi: o'rin, jamoa va ochko/ })
    expect(table.querySelector('caption')).toHaveClass('sr-only')
    for (const th of within(table).getAllByRole('columnheader')) expect(th).toHaveAttribute('scope', 'col')
    const region = screen.getByRole('region', { name: 'FIFA reytingi' })
    expect(region).toHaveClass('table-scroll')
    expect(region).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('link', { name: 'Spain' })).toHaveAttribute('href', '/team/4')
    const [, first, second] = within(table).getAllByRole('row')
    expect(first).toHaveClass('rk-top')
    expect(
      within(second)
        .getAllByRole('cell')
        .map(c => c.textContent),
    ).toEqual(['—', 'Narnia', '—'])
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(api.rankings).toHaveBeenCalledWith('fifa', expect.anything())
  })

  it("noma'lum kind → 404 sahifa, serverga so'rov yo'q", () => {
    render(<Rankings kind="__proto__" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Sahifa topilmadi' })).toBeInTheDocument()
    expect(api.rankings).not.toHaveBeenCalled()
    expect(isKnownKind('uefa')).toBe(true)
    expect(isKnownKind('constructor')).toBe(false)
    expect(isKnownKind(undefined)).toBe(false)
  })

  it("xato holati qayta urinish bilan; bo'sh ro'yxat → Empty", async () => {
    api.rankings
      .mockRejectedValueOnce(new ApiError('x', { status: 503, code: 'UPSTREAM_UNAVAILABLE' }))
      .mockResolvedValueOnce({ rows: [] })
    render(<Rankings kind="uefa" />)
    const alert = await screen.findByRole('alert')
    fireEvent.click(within(alert).getByRole('button', { name: 'Qayta urinish' }))
    expect(await screen.findByText("Reyting ma'lumoti hozircha yo'q.")).toBeInTheDocument()
    expect(api.rankings).toHaveBeenCalledTimes(2)
  })
})
