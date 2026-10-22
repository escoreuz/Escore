import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MatchRow from './MatchRow.jsx'

const base = {
  id: 501,
  home: { n: 'Arsenal', c: '#c00' },
  away: { n: 'Chelsea', c: '#00c' },
}

describe('MatchRow', () => {
  beforeEach(() => window.history.replaceState(null, '', '/team/1'))

  it("tugagan o'yin: FT, hisob, lg-match klasslari va o'yin sahifasiga havola", () => {
    const { container } = render(<MatchRow match={{ ...base, status: 'ft', hs: 2, as: 1 }} />)
    expect(container.firstChild).toHaveClass('lg-match', 'is-linkrow')
    expect(screen.getByText('FT')).toHaveClass('lg-match__status')
    const link = screen.getByRole('link', { name: "Arsenal 2 : 1 Chelsea, o'yin sahifasi" })
    expect(link).toHaveAttribute('href', '/match/501')
    expect(link).toHaveClass('lg-match__score', 'stretched-link')
    expect(link).toHaveTextContent('2 : 1')
  })

  it("jonli o'yin: daqiqa, is-live va ekran o'quvchi uchun 'Jonli' matni", () => {
    render(<MatchRow match={{ ...base, status: 'live', minute: 67, hs: 0, as: 0 }} />)
    const status = screen.getByText(/67'/)
    expect(status).toHaveClass('is-live')
    expect(status).toHaveTextContent("Jonli, 67'")
  })

  it("boshlanmagan o'yin: hisob o'rnida tire, vaqt server matnidan", () => {
    render(<MatchRow match={{ ...base, status: 'ns', time: '21:00' }} />)
    expect(screen.getByText('21:00')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveTextContent('—')
  })

  it('havola bosilganda SPA orqali o`yin sahifasiga o`tadi; ID kodlanadi', () => {
    render(<MatchRow match={{ ...base, id: 'a/b', status: 'ft', hs: 1, as: 1 }} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/match/a%2Fb')
    fireEvent.click(link, { button: 0 })
    expect(window.location.pathname).toBe('/match/a%2Fb')
  })
})

describe('MatchRow — null maydonlar (API-NOTES T-03 2/3-iteratsiya)', () => {
  const noNullText = container => expect(container.textContent).not.toMatch(/null|undefined/)

  it('rejadagi o`yin: hs/as null → hisob "—", vaqt ko`rsatiladi', () => {
    const { container } = render(<MatchRow match={{ ...base, status: 'sched', hs: null, as: null, time: '19:30' }} />)
    expect(screen.getByRole('link')).toHaveTextContent('—')
    expect(screen.getByText('19:30')).toBeInTheDocument()
    noNullText(container)
  })

  it('rejadagi o`yin: ts/time null → holat "—"', () => {
    render(<MatchRow match={{ ...base, status: 'sched', hs: null, as: null, ts: null, time: null }} />)
    expect(statusCell()).toHaveTextContent('—')
  })

  it('jonli o`yin: minute null → "JONLI"', () => {
    const { container } = render(<MatchRow match={{ ...base, status: 'live', minute: null, hs: 1, as: 0 }} />)
    expect(statusCell()).toHaveTextContent(/^JONLI$/)
    expect(statusCell()).toHaveClass('is-live')
    expect(screen.getByRole('link')).toHaveTextContent('1 : 0')
    noNullText(container)
  })

  it.each([
    ['canceled', 'BEKOR QILINDI'],
    ['postponed', 'KECHIKTIRILDI'],
    ['interrupted', "TO'XTATILDI"],
  ])('status %s → "%s"', (status, label) => {
    render(<MatchRow match={{ ...base, status, hs: null, as: null }} />)
    expect(statusCell()).toHaveTextContent(label)
    expect(screen.getByRole('link')).toHaveTextContent('—')
  })

  it("to'xtatilgan o'yinda hisob bo'lsa ko'rsatiladi; bekor qilinganda yo'q", () => {
    const { unmount } = render(<MatchRow match={{ ...base, status: 'interrupted', hs: 1, as: 1 }} />)
    expect(screen.getByRole('link')).toHaveTextContent('1 : 1')
    unmount()
    render(<MatchRow match={{ ...base, status: 'canceled', hs: 1, as: 1 }} />)
    expect(screen.getByRole('link')).toHaveTextContent('—')
  })

  it('status null → holat yorlig`isiz', () => {
    const { container } = render(<MatchRow match={{ ...base, status: null, time: '18:00' }} />)
    expect(statusCell()).toBeEmptyDOMElement()
    noNullText(container)
  })

  it('home.n/away.n null → "—"; home.id/away.id null → rasmsiz Crest', () => {
    const { container } = render(
      <MatchRow
        match={{ id: 3, status: 'ft', hs: 0, as: 2, home: { n: null, id: null }, away: { n: null, id: null } }}
      />,
    )
    const teams = container.querySelectorAll('.lg-match__team')
    expect(teams[0]).toHaveTextContent('—')
    expect(teams[1]).toHaveTextContent('—')
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByRole('link', { name: "— 0 : 2 —, o'yin sahifasi" })).toBeInTheDocument()
    noNullText(container)
  })

  it('match.id null → havola qurilmaydi, qator is-static', () => {
    const { container } = render(<MatchRow match={{ ...base, id: null, status: 'ft', hs: 2, as: 2 }} />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(container.firstChild).toHaveClass('lg-match', 'is-static')
    expect(container.firstChild).not.toHaveClass('is-linkrow')
    expect(container.querySelector('.lg-match__score')).toHaveTextContent('2 : 2')
  })
})

function statusCell() {
  return document.querySelector('.lg-match__status')
}
