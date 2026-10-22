import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('./api.js', () => ({
  api: { home: vi.fn(), bootstrap: vi.fn() },
  useApi: () => ({ data: null, loading: true, error: null, reload: vi.fn() }),
}))

// Butun ilova + lazy chunklar parallel ishga tushganda sekin transform qilinadi
vi.setConfig({ testTimeout: 20_000 })

const { default: App, pageKey } = await import('./App.jsx')

describe('App', () => {
  beforeEach(() => window.history.replaceState(null, '', '/'))

  it('bitta <main id="main" tabIndex=-1> va skip-link', () => {
    render(<App />)
    const mains = document.querySelectorAll('main')
    expect(mains).toHaveLength(1)
    expect(mains[0]).toHaveAttribute('id', 'main')
    expect(mains[0]).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('link', { name: "Asosiy mazmunga o'tish" })).toHaveAttribute('href', '#main')
  })

  it("noma'lum yo'l → 404 sahifa (lazy) va noindex", async () => {
    window.history.replaceState(null, '', '/bunday-sahifa-yoq')
    render(<App />)
    // Lazy chunk birinchi marta transform qilinadi — kutish oynasi kengroq
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sahifa topilmadi' }, { timeout: 10_000 }),
    ).toBeInTheDocument()
    // useSeo passiv effektda ishlaydi — sarlavhadan keyin bir oz kechikishi mumkin
    await waitFor(() =>
      expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow'),
    )
  })

  it('pageKey ID/slug/bo`lim bo`yicha farqlanadi', () => {
    expect(pageKey({ name: 'match', id: '1' })).not.toBe(pageKey({ name: 'match', id: '2' }))
    expect(pageKey({ name: 'section', section: 'A' })).toBe('sectionA')
    expect(pageKey({ name: 'home' })).toBe('home')
  })
})
