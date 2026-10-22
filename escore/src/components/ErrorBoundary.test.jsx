import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBoundary, { ErrorFallback } from './ErrorBoundary.jsx'

const EXPECTED_MESSAGE = 'render xatosi'

function Boom({ fail }) {
  if (fail) throw new Error(EXPECTED_MESSAGE)
  return <p>Sahifa tarkibi</p>
}

// React dev rejimi render xatosini window 'error' hodisasi sifatida qayta tashlaydi; jsdom uni "Uncaught"
// deb stderr'ga yozadi. Faqat shu testdagi KUTILGAN xato jimlanadi — boshqa xatolar ko'rinib qoladi.
const silenceExpectedError = e => {
  if (e.error?.message === EXPECTED_MESSAGE) e.preventDefault()
}

// Faqat xato chiqaradigan testlarda chaqiriladi: console.error spy + window tinglovchisi
function expectRenderError() {
  window.addEventListener('error', silenceExpectedError)
  return vi.spyOn(console, 'error').mockImplementation(() => {})
}

afterEach(() => {
  window.removeEventListener('error', silenceExpectedError)
  vi.restoreAllMocks()
})

describe('ErrorBoundary', () => {
  it('xato bo`lmasa bolalarni ko`rsatadi', () => {
    render(
      <ErrorBoundary resetKey="a">
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Sahifa tarkibi')).toBeInTheDocument()
  })

  it('render xatosida role=alert fallback (h1) va "Qayta yuklash" tugmasi; xato loglanadi', () => {
    const consoleError = expectRenderError()
    render(
      <ErrorBoundary resetKey="a">
        <Boom fail />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent("Sahifani ko'rsatib bo'lmadi")
    expect(screen.getByRole('heading', { level: 1, name: "Sahifani ko'rsatib bo'lmadi" })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Qayta yuklash' })).toBeInTheDocument()
    expect(consoleError.mock.calls.some(c => c[0] === '[ErrorBoundary]')).toBe(true)
  })

  it('resetKey o`zgarsa (boshqa sahifa) xato holati tozalanadi', () => {
    expectRenderError()
    const { rerender } = render(
      <ErrorBoundary resetKey="match1">
        <Boom fail />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    rerender(
      <ErrorBoundary resetKey="home">
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('Sahifa tarkibi')).toBeInTheDocument()
  })

  it('ErrorFallback tugmasi onReload ni chaqiradi', () => {
    const onReload = vi.fn()
    render(<ErrorFallback onReload={onReload} />)
    fireEvent.click(screen.getByRole('button', { name: 'Qayta yuklash' }))
    expect(onReload).toHaveBeenCalledTimes(1)
  })
})
