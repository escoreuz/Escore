import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const { mockApi } = vi.hoisted(() => ({ mockApi: { matches: vi.fn() } }))
vi.mock('../../api.js', async importOriginal => ({ ...(await importOriginal()), api: mockApi }))

import { ApiError } from '../../api.js'
import { useMatches } from './useMatches.js'
import { IDLE_POLL_MS } from './matchText.js'

const TODAY = '2026-10-22'
const PAST = '2026-10-21'
const mk = (id, extra = {}) => ({
  id,
  status: 'sched',
  hs: null,
  as: null,
  home: { n: `H${id}` },
  away: { n: `A${id}` },
  ...extra,
})
const resp = matches => ({ matches, liveCount: 0, partial: false })

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const flush = () => act(async () => {})
const advance = ms => act(() => vi.advanceTimersByTimeAsync(ms))
const lastOpts = () => mockApi.matches.mock.calls.at(-1)[1]

beforeEach(() => {
  vi.useFakeTimers()
  mockApi.matches.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useMatches', () => {
  it("kech kelgan eski kalit javobi yangisini buzmaydi, eski so'rov bekor qilinadi", async () => {
    const first = deferred()
    const second = deferred()
    mockApi.matches.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result, rerender } = renderHook(p => useMatches(p), {
      initialProps: { date: TODAY, status: 'all', q: '', isToday: true },
    })
    await flush()
    const firstSignal = lastOpts().signal
    rerender({ date: PAST, status: 'all', q: '', isToday: false })
    await flush()
    expect(firstSignal.aborted).toBe(true)
    expect(result.current.loading).toBe(true)

    await act(async () => second.resolve(resp([mk(2)])))
    await act(async () => first.resolve(resp([mk(1)])))
    expect(result.current.matches.map(m => m.id)).toEqual([2])
  })

  it("bugun: birinchi yuklash va polling fresh:true; o'tgan sanada polling yo'q", async () => {
    mockApi.matches.mockResolvedValue(resp([mk(1)]))
    const { rerender } = renderHook(p => useMatches(p), {
      initialProps: { date: TODAY, status: 'all', q: '', isToday: true },
    })
    await flush()
    expect(lastOpts().fresh).toBe(true)
    await advance(IDLE_POLL_MS)
    expect(mockApi.matches).toHaveBeenCalledTimes(2)
    expect(lastOpts()).toMatchObject({ fresh: true })

    rerender({ date: PAST, status: 'all', q: '', isToday: false })
    await flush()
    expect(lastOpts().fresh).toBe(false)
    const calls = mockApi.matches.mock.calls.length
    await advance(IDLE_POLL_MS * 2)
    expect(mockApi.matches).toHaveBeenCalledTimes(calls)
  })

  it("poll xatosida ro'yxat saqlanadi, keyingi muvaffaqiyatda xato tozalanadi", async () => {
    mockApi.matches
      .mockResolvedValueOnce(resp([mk(1)]))
      .mockRejectedValueOnce(new ApiError('down', { status: 503, code: 'UPSTREAM_UNAVAILABLE' }))
      .mockResolvedValueOnce(resp([mk(1), mk(2)]))
    const { result } = renderHook(() => useMatches({ date: TODAY, status: 'all', q: '', isToday: true }))
    await flush()
    expect(result.current.matches).toHaveLength(1)

    await advance(IDLE_POLL_MS)
    expect(result.current.error).toBeTruthy()
    expect(result.current.hasData).toBe(true)
    expect(result.current.matches).toHaveLength(1)

    await advance(IDLE_POLL_MS)
    expect(result.current.error).toBeNull()
    expect(result.current.matches).toHaveLength(2)
  })

  it("unmount'da so'rov bekor qilinadi", async () => {
    mockApi.matches.mockReturnValue(new Promise(() => {}))
    const { unmount } = renderHook(() => useMatches({ date: TODAY, status: 'all', q: '', isToday: true }))
    await flush()
    const { signal } = lastOpts()
    unmount()
    expect(signal.aborted).toBe(true)
  })
})
