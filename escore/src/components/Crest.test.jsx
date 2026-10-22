import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import Crest from './Crest.jsx'
import Flag from './Flag.jsx'
import { api } from '../api.js'

describe('Crest', () => {
  it('dekorativ: aria-hidden, initsiallar format.js dan', () => {
    const { container } = render(<Crest name="Real Madrid" />)
    const badge = container.firstChild
    expect(badge).toHaveAttribute('aria-hidden', 'true')
    expect(badge).toHaveTextContent('RM')
    expect(container.querySelector('img')).toBeNull()
  })

  it('fon rangiga mos o`qiladigan matn rangi (qora/oq), tanilmagan rangda inline color yo`q', () => {
    const { container, rerender } = render(<Crest name="Wolves" c="#e08a1e" />)
    expect(container.firstChild.style.color).toBe('rgb(0, 0, 0)')
    rerender(<Crest name="Celtic" c="#1f5130" />)
    expect(container.firstChild.style.color).toBe('rgb(255, 255, 255)')
    rerender(<Crest name="Celtic" />)
    expect(container.firstChild.style.color).toBe('rgb(255, 255, 255)')
    rerender(<Crest name="X" c="red" />)
    expect(container.firstChild.style.color).toBe('')
  })

  it('id bo`lsa lazy/async rasm, o`lcham bilan', () => {
    const { container } = render(<Crest name="Arsenal" id={42} size="lg" />)
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', api.img('team', 42))
    expect(img).toHaveAttribute('loading', 'lazy')
    expect(img).toHaveAttribute('decoding', 'async')
    expect(img).toHaveAttribute('width', '46')
    expect(img).toHaveAttribute('height', '46')
    expect(img).toHaveAttribute('alt', '')
    expect(container.firstChild).toHaveClass('sc-badge', 'sc-badge--lg')
  })

  it('rasm xatosida initsiallarga qaytadi, yangi id bilan qayta urinadi', () => {
    const { container, rerender } = render(<Crest name="Arsenal" id={1} kind="player" size="sm" />)
    fireEvent.error(container.querySelector('img'))
    expect(container.querySelector('img')).toBeNull()
    expect(container.firstChild).toHaveTextContent('ARS')
    rerender(<Crest name="Arsenal" id={2} kind="player" size="sm" />)
    expect(container.querySelector('img')).toHaveAttribute('src', api.img('player', 2))
  })
})

describe('Flag', () => {
  it('label berilsa role=img va aria-label', () => {
    const { getByRole } = render(<Flag value="🇺🇿" label="O'zbekiston" />)
    expect(getByRole('img', { name: "O'zbekiston" })).toHaveTextContent('🇺🇿')
  })

  it('label bo`lmasa emoji dekorativ (aria-hidden)', () => {
    const { container } = render(<Flag value="🇪🇸" />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('globus emojisi rasmga almashadi: label bo`lsa alt=label, bo`lmasa dekorativ', () => {
    const { container, unmount } = render(<Flag value="🌍" label="Dunyo" />)
    const labelled = container.querySelector('img.flag-globe')
    expect(labelled).toHaveAttribute('alt', 'Dunyo')
    expect(labelled).not.toHaveAttribute('aria-hidden')
    unmount()
    const { container: c2 } = render(<Flag value="🌎" />)
    const img = c2.querySelector('img.flag-globe')
    expect(img).toHaveAttribute('alt', '')
    expect(img).toHaveAttribute('aria-hidden', 'true')
  })

  it('qiymat bo`lmasa hech narsa chizmaydi', () => {
    const { container } = render(<Flag value={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })
})
