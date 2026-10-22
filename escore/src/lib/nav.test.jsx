import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import {
  parseRoute,
  safeDecode,
  migrateLegacyHash,
  navigate,
  isInternalPath,
  Link,
  useRoute,
  useFocusOnRouteChange,
} from './nav.jsx'

const setUrl = url => window.history.replaceState(null, '', url)
const BACKSLASH = String.fromCharCode(92)

describe('safeDecode', () => {
  it('oddiy foiz-kodlashni ochadi', () => {
    expect(safeDecode('CHEMPIONLAR%20LIGASI')).toBe('CHEMPIONLAR LIGASI')
  })
  it("noto'g'ri % da yiqilmaydi va xom satrni qaytaradi", () => {
    expect(safeDecode('%E0%A4%A')).toBe('%E0%A4%A')
    expect(safeDecode('100%')).toBe('100%')
  })
})

describe('parseRoute', () => {
  it.each([
    ['/', { name: 'home' }],
    ['/score', { name: 'score' }],
    ['/news', { name: 'news' }],
    ['/archive', { name: 'archive' }],
    ['/rankings/fifa', { name: 'rankings', kind: 'fifa' }],
    ['/news/real-madrid-yutdi', { name: 'newsArticle', slug: 'real-madrid-yutdi' }],
    ['/match/12345', { name: 'match', id: '12345' }],
    ['/league/17', { name: 'league', id: '17' }],
    ['/team/42', { name: 'team', id: '42' }],
    ['/player/7', { name: 'player', id: '7' }],
    ['/coach/9', { name: 'coach', id: '9' }],
    ['/referee/3', { name: 'referee', id: '3' }],
    ['/article/demo-maqola', { name: 'article', slug: 'demo-maqola' }],
    ['/section/CHEMPIONLAR%20LIGASI', { name: 'section', section: 'CHEMPIONLAR LIGASI' }],
    ['/search/Messi%20gol', { name: 'search', query: 'Messi gol' }],
  ])('%s → %o', (path, expected) => {
    expect(parseRoute(path)).toEqual(expected)
  })

  it("oxirgi `/` ni e'tiborsiz qoldiradi", () => {
    expect(parseRoute('/score/')).toEqual({ name: 'score' })
    expect(parseRoute('/match/5/')).toEqual({ name: 'match', id: '5' })
  })

  it('qidiruvdagi kodlangan `/` ni parametr ichida saqlaydi', () => {
    expect(parseRoute('/search/a%2Fb')).toEqual({ name: 'search', query: 'a/b' })
  })

  it("noto'g'ri % bo'lsa yiqilmaydi, xom qiymat beradi", () => {
    expect(parseRoute('/search/%E0%A4%A')).toEqual({ name: 'search', query: '%E0%A4%A' })
  })

  it.each(['/nomalum', '/match', '/match/1/extra', '/Score', '/search/%20', '/__proto__/x', '/constructor/1', ''])(
    'noma\'lum yoki yaroqsiz "%s" → notFound',
    path => {
      expect(parseRoute(path).name).toBe(path === '' ? 'home' : 'notFound')
    },
  )
})

describe('migrateLegacyHash', () => {
  beforeEach(() => setUrl('/'))

  it('eski #/... havolani yangi yo`lga ko`chiradi', () => {
    setUrl('/#/match/77')
    expect(migrateLegacyHash()).toBe(true)
    expect(window.location.pathname).toBe('/match/77')
    expect(window.location.hash).toBe('')
  })

  it('#//host qiymati boshqa originga olib chiqmaydi', () => {
    setUrl('/#//evil.example/x')
    expect(migrateLegacyHash()).toBe(true)
    expect(window.location.origin).toBe(new URL(document.baseURI).origin)
    expect(window.location.pathname).toBe('/evil.example/x')
  })

  it('oddiy anchor (#main) ga tegmaydi', () => {
    setUrl('/score#main')
    expect(migrateLegacyHash()).toBe(false)
    expect(window.location.pathname).toBe('/score')
  })
})

function RouteProbe() {
  const route = useRoute()
  return <output data-testid="route">{JSON.stringify(route)}</output>
}

describe('navigate + useRoute', () => {
  beforeEach(() => setUrl('/'))

  it('navigate pushState qiladi va useRoute yangilanadi', () => {
    render(<RouteProbe />)
    const before = window.history.length
    act(() => navigate('/team/5'))
    expect(window.location.pathname).toBe('/team/5')
    expect(window.history.length).toBe(before + 1)
    expect(screen.getByTestId('route').textContent).toBe('{"name":"team","id":"5"}')
  })

  it('replace: true tarixga yozuv qo`shmaydi', () => {
    render(<RouteProbe />)
    const before = window.history.length
    act(() => navigate('/news', { replace: true }))
    expect(window.history.length).toBe(before)
    expect(screen.getByTestId('route').textContent).toBe('{"name":"news"}')
  })

  it('popstate (orqaga) ni tinglaydi', () => {
    render(<RouteProbe />)
    act(() => {
      setUrl('/archive')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(screen.getByTestId('route').textContent).toBe('{"name":"archive"}')
  })

  it("eski komponentlarning hash o'tishini (hashchange) yangi yo'lga aylantiradi", () => {
    render(<RouteProbe />)
    act(() => {
      setUrl('/#/match/9')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(window.location.pathname).toBe('/match/9')
    expect(screen.getByTestId('route').textContent).toBe('{"name":"match","id":"9"}')
  })
})

describe('Link', () => {
  beforeEach(() => setUrl('/'))

  // Ota element bubble bosqichida Link qaror qabul qilgandan keyin defaultPrevented ni yozib oladi
  function renderLink(props) {
    const seen = []
    render(
      <div
        onClick={e => {
          seen.push(e.defaultPrevented)
          e.preventDefault() // jsdom haqiqiy navigatsiya qilmasin
        }}
      >
        <Link to="/score" {...props}>
          Score
        </Link>
      </div>,
    )
    return { seen, link: screen.getByRole('link', { name: 'Score' }) }
  }

  it('oddiy <a href> chiqaradi', () => {
    const { link } = renderLink()
    expect(link).toHaveAttribute('href', '/score')
  })

  it('oddiy chap bosishda SPA o`tishi (preventDefault + pushState)', () => {
    const { seen, link } = renderLink()
    fireEvent.click(link, { button: 0 })
    expect(seen).toEqual([true])
    expect(window.location.pathname).toBe('/score')
  })

  it.each([['ctrlKey'], ['metaKey'], ['shiftKey'], ['altKey']])('%s bilan bosilsa brauzerga qoldiradi', mod => {
    const { seen, link } = renderLink()
    fireEvent.click(link, { button: 0, [mod]: true })
    expect(seen).toEqual([false])
    expect(window.location.pathname).toBe('/')
  })

  it("o'rta tugma (button=1) brauzerga qoldiriladi", () => {
    const { seen, link } = renderLink()
    fireEvent.click(link, { button: 1 })
    expect(seen).toEqual([false])
  })

  it('target=_blank bo`lsa preventDefault qilmaydi', () => {
    const { seen, link } = renderLink({ target: '_blank' })
    fireEvent.click(link, { button: 0 })
    expect(seen).toEqual([false])
  })

  it('foydalanuvchi onClick ichida preventDefault qilsa navigatsiya bo`lmaydi', () => {
    const { link } = renderLink({ onClick: e => e.preventDefault() })
    fireEvent.click(link, { button: 0 })
    expect(window.location.pathname).toBe('/')
  })
})

function FocusProbe() {
  const route = useRoute()
  useFocusOnRouteChange(window.location.pathname)
  return (
    <main id="main" tabIndex={-1}>
      {route.name}
    </main>
  )
}

describe('useFocusOnRouteChange', () => {
  beforeEach(() => setUrl('/'))

  it('birinchi yuklanishda fokus/scroll qilmaydi, sahifa almashganda qiladi', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    render(<FocusProbe />)
    expect(scrollTo).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(document.body)

    act(() => navigate('/score'))
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
    expect(document.activeElement).toBe(document.getElementById('main'))
    scrollTo.mockRestore()
  })
})

describe('xavfsiz yo`llar (F6)', () => {
  beforeEach(() => setUrl('/'))

  it.each(['/score', '/match/1?x=1'])('isInternalPath("%s") → true', p => {
    expect(isInternalPath(p)).toBe(true)
  })

  // BACKSLASH — String.fromCharCode orqali: manba matnida escape chalkashligi bo'lmasin
  it.each([
    '//evil.example',
    `/${BACKSLASH}evil.example`,
    `/a${BACKSLASH}b`,
    'https://x.uz',
    'javascript:alert(1)',
    '',
    null,
  ])('isInternalPath(%s) → false', p => {
    expect(isInternalPath(p)).toBe(false)
  })

  it('navigate tashqi http(s) bo`lmagan manzilni bajarmaydi va ogohlantiradi', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    navigate('javascript:alert(1)')
    navigate(`/${BACKSLASH}evil.example`)
    expect(window.location.pathname).toBe('/')
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  it('eski hashdagi teskari slash boshqa originga olib chiqmaydi', () => {
    setUrl(`/#/${BACKSLASH}evil.example/x`)
    expect(migrateLegacyHash()).toBe(true)
    expect(window.location.pathname).toBe('/evil.example/x')
  })
})
