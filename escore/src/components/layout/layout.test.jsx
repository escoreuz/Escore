import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

vi.mock('../../api.js', () => ({
  api: { bootstrap: vi.fn() },
  useApi: () => ({ data: { issue: { volume: 'XII SON', no: '№ 247', city: 'TOSHKENT' } }, loading: false }),
}))

const { default: Masthead, mastheadDate } = await import('./Masthead.jsx')
const { default: SettingsMenu } = await import('./SettingsMenu.jsx')
const { default: Ticker } = await import('./Ticker.jsx')
const { activeNavPath } = await import('./Nav.jsx')

afterEach(() => vi.useRealTimers())

describe('Masthead', () => {
  beforeEach(() => window.history.replaceState(null, '', '/'))

  it('sanani Toshkent vaqtida o`zbekcha hafta kuni va oy bilan ko`rsatadi (soxta vaqt)', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    // UTC 20:30 → Toshkentda ertasi kun 01:30 (juma)
    vi.setSystemTime(new Date('2026-10-15T20:30:00Z'))
    render(<Masthead route={{ name: 'home' }} />)
    expect(screen.getByText('Juma, 16-oktabr 2026')).toBeInTheDocument()
    expect(mastheadDate(new Date('2026-01-01T12:00:00Z'))).toBe('Payshanba, 1-yanvar 2026')
  })

  it("uydirma ob-havo/narx yo'q; logo h1 emas; son raqami bootstrapdan", () => {
    render(<Masthead route={{ name: 'home' }} />)
    expect(screen.queryByText(/°C|NARXI|so'm/)).toBeNull()
    expect(screen.getByText('ONLAYN NASHR')).toBeInTheDocument()
    expect(screen.getByText('XII SON · № 247')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.getByRole('link', { name: 'eSCORE — bosh sahifa' })).toHaveAttribute('href', '/')
  })

  it('nav: aria-label va faol bo`limda aria-current="page"', () => {
    render(<Masthead route={{ name: 'match', id: '1' }} />)
    const nav = screen.getByRole('navigation', { name: "Asosiy bo'limlar" })
    const active = nav.querySelectorAll('[aria-current="page"]')
    expect(active).toHaveLength(1)
    expect(active[0]).toHaveTextContent('Score')
  })
})

describe('activeNavPath', () => {
  it.each([
    [{ name: 'home' }, '/'],
    [{ name: 'newsArticle', slug: 'x' }, '/news'],
    [{ name: 'section', section: 'TRANSFER' }, '/section/TRANSFER'],
    [{ name: 'section', section: 'MILLIY TERMA' }, '/section/MILLIY%20TERMA'],
    [{ name: 'player', id: '1' }, '/score'],
    [{ name: 'notFound' }, null],
    [{ name: 'search', query: 'a' }, null],
  ])('%o → %s', (route, expected) => {
    expect(activeNavPath(route)).toBe(expected)
  })
})

describe('SettingsMenu', () => {
  const button = () => screen.getByRole('button', { name: 'Sozlamalar' })

  it('disclosure: aria-expanded/aria-controls, role=menu yo`q', () => {
    render(<SettingsMenu />)
    expect(button()).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(button())
    expect(button()).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById(button().getAttribute('aria-controls'))).not.toBeNull()
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByLabelText('Vaqt mintaqasi (soat)').tagName).toBe('SELECT')
  })

  it('Escape panelni yopadi va fokusni tugmaga qaytaradi', () => {
    render(<SettingsMenu />)
    fireEvent.click(button())
    const select = screen.getByLabelText('Vaqt mintaqasi (soat)')
    select.focus()
    fireEvent.keyDown(select, { key: 'Escape' })
    expect(button()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('Vaqt mintaqasi (soat)')).toBeNull()
    expect(document.activeElement).toBe(button())
  })

  it('tashqariga bosish va fokus chiqishi panelni yopadi', () => {
    render(
      <>
        <SettingsMenu />
        <button type="button">Tashqi</button>
      </>,
    )
    fireEvent.click(button())
    fireEvent.pointerDown(document.body)
    expect(button()).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(button())
    fireEvent.blur(screen.getByLabelText('Vaqt mintaqasi (soat)'), {
      relatedTarget: screen.getByRole('button', { name: 'Tashqi' }),
    })
    expect(button()).toHaveAttribute('aria-expanded', 'false')
  })

  it('tema tugmalari aria-pressed ni sozlamaga ko`ra yangilaydi', () => {
    render(<SettingsMenu />)
    fireEvent.click(button())
    const dark = screen.getByRole('button', { name: /Tungi/ })
    act(() => fireEvent.click(dark))
    expect(dark).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Yorug'/ })).toHaveAttribute('aria-pressed', 'false')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    act(() => fireEvent.click(screen.getByRole('button', { name: /Yorug'/ })))
  })
})

describe('Ticker', () => {
  it('region, pauza tugmasi (aria-pressed, is-paused) va ikkinchi nusxa aria-hidden', () => {
    const { container } = render(<Ticker items={['Birinchi xabar', 'Ikkinchi xabar']} />)
    const region = screen.getByRole('region', { name: "So'nggi daqiqa xabarlari" })
    expect(container.querySelectorAll('.ticker__item')).toHaveLength(4)
    expect(container.querySelectorAll('.ticker__item[aria-hidden="true"]')).toHaveLength(2)
    const pause = screen.getByRole('button', { name: "Lentani to'xtatish" })
    expect(pause).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(pause)
    expect(pause).toHaveAttribute('aria-pressed', 'true')
    expect(region).toHaveClass('ticker', 'is-paused')
  })

  it("bo'sh ro'yxatda hech narsa chizmaydi", () => {
    const { container } = render(<Ticker items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('Nav bo`limlari', () => {
  it("inNav:false bo'lim (MUXBIR USTUNI) navigatsiyada ko'rinmaydi", () => {
    render(<Masthead route={{ name: 'home' }} />)
    expect(screen.queryByRole('link', { name: /Muxbir ustuni/i })).toBeNull()
    expect(screen.getByRole('link', { name: 'Intervyu' })).toBeInTheDocument()
  })
})
