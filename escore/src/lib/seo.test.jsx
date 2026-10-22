import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { useSeo, DEFAULT_TITLE } from './seo.js'

const meta = sel => document.head.querySelector(sel)?.getAttribute('content')

function Page(props) {
  useSeo(props)
  return null
}

describe('useSeo', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    document.title = ''
    window.history.replaceState(null, '', '/news/test-slug')
  })

  it('title, description, canonical, og va twitter teglarini yozadi', () => {
    render(<Page title="Messi gol urdi" description="Qisqa tavsif" path="/news/messi" type="article" />)
    const origin = window.location.origin
    expect(document.title).toBe('Messi gol urdi | eSCORE')
    expect(meta('meta[name="description"]')).toBe('Qisqa tavsif')
    expect(document.head.querySelector('link[rel="canonical"]').getAttribute('href')).toBe(`${origin}/news/messi`)
    expect(meta('meta[property="og:title"]')).toBe('Messi gol urdi | eSCORE')
    expect(meta('meta[property="og:type"]')).toBe('article')
    expect(meta('meta[property="og:url"]')).toBe(`${origin}/news/messi`)
    expect(meta('meta[property="og:image"]')).toBe(`${origin}/og-default.png`)
    expect(meta('meta[property="og:image:width"]')).toBe('1200')
    expect(meta('meta[name="twitter:card"]')).toBe('summary_large_image')
    expect(meta('meta[name="robots"]')).toBeUndefined()
  })

  it("path berilmasa joriy yo'l canonical bo'ladi; title yo'q bo'lsa standart sarlavha", () => {
    render(<Page />)
    expect(document.title).toBe(DEFAULT_TITLE)
    expect(document.head.querySelector('link[rel="canonical"]').getAttribute('href')).toBe(
      `${window.location.origin}/news/test-slug`,
    )
  })

  it("maqola rasmi mutlaq URL bo'lsa o'zgarmaydi, o'lcham teglari olib tashlanadi", () => {
    render(<Page title="A" image="https://cdn.example.com/a.jpg" />)
    expect(meta('meta[property="og:image"]')).toBe('https://cdn.example.com/a.jpg')
    expect(meta('meta[property="og:image:width"]')).toBeUndefined()
  })

  it('noindex robots meta qo`shadi va keyingi sahifada olib tashlaydi', () => {
    const { rerender } = render(<Page title="404" noindex />)
    expect(meta('meta[name="robots"]')).toBe('noindex, follow')
    rerender(<Page title="Bosh" />)
    expect(meta('meta[name="robots"]')).toBeUndefined()
  })

  it('JSON-LD ni `<` escape qilib yozadi va unmountda o`chiradi', () => {
    const { unmount } = render(<Page title="A" jsonLd={{ '@type': 'NewsArticle', headline: '</script><b>x' }} />)
    const script = document.getElementById('seo-jsonld')
    expect(script.type).toBe('application/ld+json')
    expect(script.textContent).not.toContain('</script>')
    expect(JSON.parse(script.textContent).headline).toBe('</script><b>x')
    unmount()
    expect(document.getElementById('seo-jsonld')).toBeNull()
  })
})

describe('useSeo unmount (F9)', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
  })

  it('noindex sahifa unmount bo`lganda robots meta olib tashlanadi; canonical keyingi sahifa yozadi', () => {
    const { unmount } = render(<Page title="404" noindex />)
    expect(meta('meta[name="robots"]')).toBe('noindex, follow')
    unmount()
    expect(meta('meta[name="robots"]')).toBeUndefined()
    render(<Page title="Keyingi" path="/score" />)
    expect(document.head.querySelector('link[rel="canonical"]').getAttribute('href')).toBe(
      `${window.location.origin}/score`,
    )
  })
})
