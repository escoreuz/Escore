import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Loading, ErrorBox, Empty, AsyncView, errorText } from './States.jsx'
import { ApiError } from '../api.js'

const err = (code, message = 'ichki xabar') => new ApiError(message, { code })

describe('Loading', () => {
  it('role=status va aria-live=polite bilan matnni ko`rsatadi', () => {
    render(<Loading label="Maqola yuklanmoqda…" />)
    const box = screen.getByRole('status')
    expect(box).toHaveAttribute('aria-live', 'polite')
    expect(box).toHaveTextContent('Maqola yuklanmoqda…')
  })

  it('label berilmasa standart matn', () => {
    render(<Loading />)
    expect(screen.getByRole('status')).toHaveTextContent('Yuklanmoqda…')
  })
})

describe('ErrorBox', () => {
  it('UPSTREAM_UNAVAILABLE uchun maxsus matn, role=alert', () => {
    render(<ErrorBox error={err('UPSTREAM_UNAVAILABLE')} />)
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Ma'lumot manbai vaqtincha ishlamayapti. Birozdan keyin qayta urinib ko'ring.",
    )
  })

  it('NOT_FOUND → topilmadi matni', () => {
    render(<ErrorBox error={err('NOT_FOUND')} />)
    expect(screen.getByRole('alert')).toHaveTextContent("So'ralgan ma'lumot topilmadi.")
  })

  it.each(['NETWORK', 'TIMEOUT'])('%s → "Server bilan aloqa yo`q"', code => {
    render(<ErrorBox error={err(code)} />)
    expect(screen.getByRole('alert')).toHaveTextContent("Server bilan aloqa yo'q")
  })

  it('hech qachon port yoki ichki tafsilotni ko`rsatmaydi', () => {
    const leaky = new ApiError('connect ECONNREFUSED 127.0.0.1:4500 at http://localhost:4500/api', { code: 'NETWORK' })
    const { unmount } = render(<ErrorBox error={leaky} />)
    expect(screen.getByRole('alert').textContent).not.toMatch(/4500|localhost|ECONNREFUSED/)
    unmount()
    render(<ErrorBox error={new TypeError('Cannot read properties of undefined (port 4500)')} />)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).not.toMatch(/4500|Cannot read/)
    expect(alert).toHaveTextContent("Ma'lumotni yuklab bo'lmadi")
  })

  it('eski imzo: message={error} obyekt bilan ham ishlaydi; satr — tayyor matn', () => {
    const { unmount } = render(<ErrorBox message={err('UPSTREAM_UNAVAILABLE')} />)
    expect(screen.getByRole('alert')).toHaveTextContent('vaqtincha ishlamayapti')
    unmount()
    render(<ErrorBox message="Maqola topilmadi" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Maqola topilmadi')
  })

  it('onRetry berilsa "Qayta urinish" tugmasi chaqiradi, berilmasa tugma yo`q', () => {
    const onRetry = vi.fn()
    const { unmount } = render(<ErrorBox error={err('NETWORK')} onRetry={onRetry} />)
    const btn = screen.getByRole('button', { name: 'Qayta urinish' })
    expect(btn).toHaveClass('state__retry')
    fireEvent.click(btn)
    expect(onRetry).toHaveBeenCalledTimes(1)
    unmount()
    render(<ErrorBox error={err('NETWORK')} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('level=1 bo`lsa sarlavha h1', () => {
    render(<ErrorBox error={err('NOT_FOUND')} level={1} title="Jamoa topilmadi" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Jamoa topilmadi' })).toBeInTheDocument()
  })
})

describe('errorText', () => {
  it('noma`lum kod va bo`sh qiymatda umumiy matn', () => {
    expect(errorText(err('SOMETHING_NEW'))).toMatch(/yuklab bo'lmadi/)
    expect(errorText(null)).toMatch(/yuklab bo'lmadi/)
    expect(errorText('   ')).toMatch(/yuklab bo'lmadi/)
  })

  it('prototip kalitlari (__proto__, constructor, toString) umumiy matnga tushadi', () => {
    for (const code of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      expect(errorText(err(code))).toBe("Ma'lumotni yuklab bo'lmadi. Birozdan keyin qayta urinib ko'ring.")
    }
  })

  it('CONFIG/BAD_RESPONSE — sozlama xatosi', () => {
    expect(errorText(err('BAD_RESPONSE'))).toMatch(/API manzili noto'g'ri sozlangan/)
    expect(errorText(err('CONFIG'))).toMatch(/API manzili noto'g'ri sozlangan/)
  })
})

describe('Empty', () => {
  it('standart va maxsus matn, .state--empty klassi', () => {
    const { container, unmount } = render(<Empty />)
    expect(container.firstChild).toHaveClass('state--empty')
    expect(container).toHaveTextContent("Hozircha ma'lumot yo'q.")
    unmount()
    render(<Empty>Bugun o'yin yo'q</Empty>)
    expect(screen.getByText("Bugun o'yin yo'q")).toBeInTheDocument()
  })
})

describe('AsyncView', () => {
  const base = { data: null, error: null, loading: false, reload: () => {} }

  it('yuklanayotganda Loading (loadingText bilan)', () => {
    render(<AsyncView state={{ ...base, loading: true }} loadingText="Jadval…" children={() => 'x'} />)
    expect(screen.getByRole('status')).toHaveTextContent('Jadval…')
  })

  it('xatoda ErrorBox va retry → reload', () => {
    const reload = vi.fn()
    render(<AsyncView state={{ ...base, error: err('UPSTREAM_UNAVAILABLE'), reload }}>{() => 'x'}</AsyncView>)
    fireEvent.click(screen.getByRole('button', { name: 'Qayta urinish' }))
    expect(reload).toHaveBeenCalled()
  })

  it('bo`sh massiv/null → Empty', () => {
    const { unmount } = render(
      <AsyncView state={{ ...base, data: [] }} empty="Natija yo'q">
        {() => 'x'}
      </AsyncView>,
    )
    expect(screen.getByText("Natija yo'q")).toBeInTheDocument()
    unmount()
    render(<AsyncView state={base}>{() => 'x'}</AsyncView>)
    expect(screen.getByText("Hozircha ma'lumot yo'q.")).toBeInTheDocument()
  })

  it('data bor bo`lsa render-prop yoki oddiy children; qayta yuklashda data qoladi', () => {
    const { unmount } = render(
      <AsyncView state={{ ...base, data: [1, 2], loading: true }}>{d => <p>{d.length} ta</p>}</AsyncView>,
    )
    expect(screen.getByText('2 ta')).toBeInTheDocument()
    unmount()
    render(
      <AsyncView state={{ ...base, data: { a: 1 } }}>
        <p>tayyor</p>
      </AsyncView>,
    )
    expect(screen.getByText('tayyor')).toBeInTheDocument()
  })

  it('"Qayta urinish" bosilgach fokus yo`qolmaydi: Loading, keyin takroriy xato konteyneriga o`tadi', () => {
    function Harness() {
      const [state, setState] = useState({ data: null, error: err('NETWORK'), loading: false })
      const reload = () => setState({ data: null, error: null, loading: true })
      const fail = () => setState({ data: null, error: err('TIMEOUT'), loading: false })
      return (
        <>
          <button type="button" onClick={fail}>
            fail
          </button>
          <AsyncView state={{ ...state, reload }}>{() => 'x'}</AsyncView>
        </>
      )
    }
    render(<Harness />)
    const before = screen.getByRole('alert')
    expect(before).not.toHaveAttribute('tabindex')
    fireEvent.click(screen.getByRole('button', { name: 'Qayta urinish' }))
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('tabindex', '-1')
    expect(document.activeElement).toBe(status)
    fireEvent.click(screen.getByRole('button', { name: 'fail' }))
    expect(document.activeElement).toBe(screen.getByRole('alert'))
  })

  it('oddiy (retry`siz) yuklanish fokusni o`g`irlamaydi', () => {
    render(<AsyncView state={{ data: null, error: null, loading: true }}>{() => 'x'}</AsyncView>)
    expect(screen.getByRole('status')).not.toHaveAttribute('tabindex')
    expect(document.activeElement).toBe(document.body)
  })

  it('isEmpty prop bo`sh holatni aniqlaydi', () => {
    render(
      <AsyncView state={{ ...base, data: { items: [] } }} isEmpty={d => !d.items.length} empty="Arxiv bo'sh">
        {() => 'x'}
      </AsyncView>,
    )
    expect(screen.getByText("Arxiv bo'sh")).toBeInTheDocument()
  })
})
