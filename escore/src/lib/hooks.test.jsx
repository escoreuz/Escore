import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebounce, usePageVisible, usePolling, MIN_POLL_MS } from './hooks.js'

let visibility = 'visible'
function setVisibility(v) {
  visibility = v
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.useFakeTimers()
  visibility = 'visible'
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
})
afterEach(() => {
  vi.useRealTimers()
  delete document.visibilityState
})

describe('useDebounce', () => {
  it('qiymatni faqat `ms` jimlikdan keyin yangilaydi', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), { initialProps: { v: 'a' } })
    rerender({ v: 'ab' })
    act(() => vi.advanceTimersByTime(299))
    expect(result.current).toBe('a')
    rerender({ v: 'abc' })
    act(() => vi.advanceTimersByTime(299))
    expect(result.current).toBe('a')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe('abc')
  })
})

describe('usePageVisible', () => {
  it('visibilitychange ga javob beradi', () => {
    const { result } = renderHook(() => usePageVisible())
    expect(result.current).toBe(true)
    act(() => setVisibility('hidden'))
    expect(result.current).toBe(false)
  })
})

describe('usePolling', () => {
  it('har `ms` da chaqiradi', async () => {
    const fn = vi.fn()
    renderHook(() => usePolling(fn, 5000))
    expect(fn).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(fn).toHaveBeenCalledTimes(1)
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("sahifa yashirin bo'lsa to'xtaydi va ko'ringanda darhol chaqiradi", async () => {
    const fn = vi.fn()
    renderHook(() => usePolling(fn, 5000))
    act(() => setVisibility('hidden'))
    await act(() => vi.advanceTimersByTimeAsync(20000))
    expect(fn).not.toHaveBeenCalled()
    await act(async () => setVisibility('visible'))
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('enabled=false bo`lsa chaqirmaydi', async () => {
    const fn = vi.fn()
    renderHook(() => usePolling(fn, 5000, { enabled: false }))
    await act(() => vi.advanceTimersByTimeAsync(20000))
    expect(fn).not.toHaveBeenCalled()
  })

  it('juda kichik ms pastki chegaraga ko`tariladi, 0/NaN polling qilmaydi', async () => {
    const fast = vi.fn()
    const none = vi.fn()
    renderHook(() => usePolling(fast, 10))
    renderHook(() => usePolling(none, Number.NaN))
    await act(() => vi.advanceTimersByTimeAsync(MIN_POLL_MS - 1))
    expect(fast).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(fast).toHaveBeenCalledTimes(1)
    expect(none).not.toHaveBeenCalled()
  })

  it('xato bo`lsa loglaydi va pollingni davom ettiradi', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fn = vi.fn().mockRejectedValueOnce(new Error('tarmoq')).mockResolvedValue('ok')
    renderHook(() => usePolling(fn, 2000))
    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(err).toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(fn).toHaveBeenCalledTimes(2)
    err.mockRestore()
  })

  it('unmountdan keyin chaqirmaydi', async () => {
    const fn = vi.fn()
    const { unmount } = renderHook(() => usePolling(fn, 2000))
    unmount()
    await act(() => vi.advanceTimersByTimeAsync(10000))
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('usePolling — ustma-ust chaqiruv yo`q (F8)', () => {
  it("sekin chaqiruv tugamaguncha yashirin → ko'rinadigan o'tish yangi chaqiruv boshlamaydi", async () => {
    let resolveSlow
    const fn = vi.fn(
      () =>
        new Promise(r => {
          resolveSlow = r
        }),
    )
    renderHook(() => usePolling(fn, 2000))
    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(fn).toHaveBeenCalledTimes(1) // sekin chaqiruv davom etmoqda

    act(() => setVisibility('hidden'))
    await act(async () => setVisibility('visible'))
    expect(fn).toHaveBeenCalledTimes(1) // ustma-ust chaqirilmadi

    await act(async () => resolveSlow())
    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(fn).toHaveBeenCalledTimes(2) // tugagach polling davom etadi
  })
})
