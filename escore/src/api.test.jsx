import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StrictMode } from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import {
  api,
  ApiError,
  useApi,
  clearApiCache,
  resolveBase,
  isAbortError,
  REQUEST_TIMEOUT_MS,
  CACHE_TTL_MS,
} from './api.js'

// ---- Yordamchilar (haqiqiy tarmoqsiz) ----
function response(status, type, json) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: name => (name.toLowerCase() === 'content-type' ? type : null) },
    json,
  }
}
const jsonResponse = (body, status = 200) => response(status, 'application/json; charset=utf-8', async () => body)
const htmlResponse = (status = 200) =>
  response(status, 'text/html; charset=utf-8', async () => {
    throw new SyntaxError('Unexpected token <')
  })

// Signal bekor qilinmaguncha osilib turadigan fetch
const hangingFetch = () =>
  vi.fn(
    (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
      }),
  )

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const flushMicrotasks = () => new Promise(r => setTimeout(r, 0))

let fetchMock
beforeEach(() => {
  clearApiCache()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('resolveBase', () => {
  it('dev rejimda qiymat bo`lmasa localhost:4500', () => {
    expect(resolveBase(undefined, false)).toEqual({ base: 'http://localhost:4500', error: null })
  })

  it('production`da qiymat bo`lmasa localhost EMAS — CONFIG xatosi', () => {
    const r = resolveBase('', true)
    expect(r.base).toBeNull()
    expect(r.error).toBeInstanceOf(ApiError)
    expect(r.error.code).toBe('CONFIG')
  })

  it('hostname-only qiymatga https:// qo`shadi, oxirgi / ni olib tashlaydi', () => {
    expect(resolveBase('escore-backend.onrender.com', true).base).toBe('https://escore-backend.onrender.com')
    expect(resolveBase('http://localhost:4600/', false).base).toBe('http://localhost:4600')
    expect(resolveBase('HTTPS://x.dev', true).base).toBe('HTTPS://x.dev')
  })

  it('sxemasiz loopback manzilga http:// qo`shadi', () => {
    expect(resolveBase('localhost:4500', false).base).toBe('http://localhost:4500')
    expect(resolveBase('127.0.0.1:4500/', false).base).toBe('http://127.0.0.1:4500')
    expect(resolveBase('[::1]:4500', false).base).toBe('http://[::1]:4500')
    expect(resolveBase('localhost.evil.com', true).base).toBe('https://localhost.evil.com')
  })
})

describe('api transport', () => {
  it('muvaffaqiyatli JSON javobni qaytaradi', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 7 }))
    await expect(api.match(7)).resolves.toEqual({ id: 7 })
    expect(fetchMock).toHaveBeenCalledWith(
      api.base + '/api/matches/7',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('200 bilan kelgan null ham to`g`ri qaytadi va keshlanadi', async () => {
    fetchMock.mockResolvedValue(jsonResponse(null))
    await expect(api.featured()).resolves.toBeNull()
    await expect(api.featured()).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('503 → ApiError, code UPSTREAM_UNAVAILABLE, server matni bilan', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: "Ma'lumot manbai vaqtincha ishlamayapti", code: 'UPSTREAM_UNAVAILABLE' }, 503),
    )
    const err = await api.matches({ date: '2026-10-15' }).catch(e => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(503)
    expect(err.code).toBe('UPSTREAM_UNAVAILABLE')
    expect(err.message).toBe("Ma'lumot manbai vaqtincha ishlamayapti")
  })

  it('code bo`lmagan xato javobida status bo`yicha code tanlanadi', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 404))
    const err = await api.team(1).catch(e => e)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.status).toBe(404)
  })

  it('HTML javob → aniq "API manzili noto`g`ri sozlangan" xatosi', async () => {
    fetchMock.mockResolvedValue(htmlResponse(200))
    const err = await api.home().catch(e => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('BAD_RESPONSE')
    expect(err.message).toBe("API manzili noto'g'ri sozlangan")
  })

  it('5xx HTML (proksi xatosi) manzil xatosi deb ko`rsatilmaydi', async () => {
    fetchMock.mockResolvedValue(htmlResponse(502))
    const err = await api.home().catch(e => e)
    expect(err.code).toBe('INTERNAL')
    expect(err.status).toBe(502)
  })

  it('tarmoq xatosi → NETWORK', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const err = await api.news().catch(e => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('NETWORK')
    expect(err.status).toBe(0)
  })

  it('15 s timeout → TIMEOUT, so`rov signali bekor qilinadi', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(hangingFetch())
    const p = api.rankings('team').catch(e => e)
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1)
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    const err = await p
    expect(err.code).toBe('TIMEOUT')
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
  })

  it('chaqiruvchi signali bekor qilsa AbortError (ApiError emas)', async () => {
    fetchMock.mockImplementation(hangingFetch())
    const ctrl = new AbortController()
    const p = api.coach(3, { signal: ctrl.signal }).catch(e => e)
    ctrl.abort()
    const err = await p
    expect(isAbortError(err)).toBe(true)
    await flushMicrotasks()
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
  })

  it('oldindan bekor qilingan signal bilan so`rov yuborilmaydi', async () => {
    const ctrl = new AbortController()
    ctrl.abort()
    const err = await api.coach(3, { signal: ctrl.signal }).catch(e => e)
    expect(isAbortError(err)).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('kesh va dedupe', () => {
  it('30 s ichida kesh ishlaydi, fresh:true chetlab o`tadi', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ v: 1 })).mockResolvedValueOnce(jsonResponse({ v: 2 }))
    await expect(api.scorers()).resolves.toEqual({ v: 1 })
    await expect(api.scorers()).resolves.toEqual({ v: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await expect(api.scorers({ fresh: true })).resolves.toEqual({ v: 2 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    // fresh natija keshni yangilaydi
    await expect(api.scorers()).resolves.toEqual({ v: 2 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('TTL tugagach qayta so`raydi', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValueOnce(jsonResponse([1])).mockResolvedValueOnce(jsonResponse([2]))
    await expect(api.days()).resolves.toEqual([1])
    vi.advanceTimersByTime(CACHE_TTL_MS + 1)
    await expect(api.days()).resolves.toEqual([2])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('xato javob keshlanmaydi', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500)).mockResolvedValueOnce(jsonResponse({ ok: true }))
    await expect(api.feed()).rejects.toBeInstanceOf(ApiError)
    await expect(api.feed()).resolves.toEqual({ ok: true })
  })

  it('bir vaqtdagi bir xil so`rovlar bitta fetch bilan bajariladi', async () => {
    const d = deferred()
    fetchMock.mockReturnValue(d.promise)
    const a = api.league(17)
    const b = api.league(17)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    d.resolve(jsonResponse({ league: 'EPL' }))
    await expect(Promise.all([a, b])).resolves.toEqual([{ league: 'EPL' }, { league: 'EPL' }])
  })

  it('bir obunachi bekor qilsa, boshqasi uchun so`rov davom etadi', async () => {
    const d = deferred()
    fetchMock.mockReturnValue(d.promise)
    const ctrl = new AbortController()
    const a = api.player(9, { signal: ctrl.signal }).catch(e => e)
    const b = api.player(9)
    ctrl.abort()
    await flushMicrotasks()
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false)
    d.resolve(jsonResponse({ name: 'X' }))
    expect(isAbortError(await a)).toBe(true)
    await expect(b).resolves.toEqual({ name: 'X' })
  })
})

describe('so`rov parametrlari', () => {
  it('archive: bo`sh parametrlar tashlanadi, q trim qilinadi', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [], total: 0, page: 0, size: 20, hasMore: false }))
    await api.archive({ q: '  messi gol ', category: 'transfer', page: 2 })
    await api.archive()
    expect(fetchMock.mock.calls[0][0]).toBe(api.base + '/api/archive?q=messi+gol&category=transfer&page=2')
    expect(fetchMock.mock.calls[1][0]).toBe(api.base + '/api/archive')
  })

  it('matches: status default "all", bo`sh sana yuborilmaydi', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ matches: [] }))
    await api.matches()
    expect(fetchMock.mock.calls[0][0]).toBe(api.base + '/api/matches?status=all')
  })

  it('img URL yo`lni kodlaydi', () => {
    expect(api.img('team', '1/2')).toBe(api.base + '/api/img/team/1%2F2')
  })
})

describe('useApi', () => {
  it('dep o`zgarganda eski data bir kadr ham ko`rinmaydi va eski javob e`tiborsiz qoladi', async () => {
    const calls = {}
    const fetcher = vi.fn(id => {
      calls[id] = deferred()
      return calls[id].promise
    })
    const { result, rerender } = renderHook(({ id }) => useApi(() => fetcher(id), [id]), { initialProps: { id: 1 } })
    expect(result.current).toMatchObject({ data: null, loading: true, error: null })
    await waitFor(() => expect(calls[1]).toBeDefined())
    await act(async () => calls[1].resolve('team-1'))
    expect(result.current).toMatchObject({ data: 'team-1', loading: false })

    rerender({ id: 2 })
    // Effekt hali ishlamagan birinchi renderda ham eski data yo'q
    expect(result.current).toMatchObject({ data: null, loading: true, error: null })
    await waitFor(() => expect(calls[2]).toBeDefined())
    await act(async () => calls[2].resolve('team-2'))
    expect(result.current.data).toBe('team-2')
  })

  it('dep o`zgargach kelgan eski javob yangi holatni bosib ketmaydi', async () => {
    const calls = {}
    const fetcher = id => {
      calls[id] = deferred()
      return calls[id].promise
    }
    const { result, rerender } = renderHook(({ id }) => useApi(() => fetcher(id), [id]), { initialProps: { id: 1 } })
    await waitFor(() => expect(calls[1]).toBeDefined())
    rerender({ id: 2 })
    await waitFor(() => expect(calls[2]).toBeDefined())
    await act(async () => calls[1].resolve('eski'))
    expect(result.current).toMatchObject({ data: null, loading: true })
    await act(async () => calls[2].resolve('yangi'))
    expect(result.current).toMatchObject({ data: 'yangi', loading: false })
  })

  it('dep o`zgarishi va unmount`da signal bekor qilinadi', async () => {
    const signals = []
    const fn = vi.fn(({ signal }) => {
      signals.push(signal)
      return new Promise(() => {})
    })
    const { rerender, unmount } = renderHook(({ id }) => useApi(fn, [id]), { initialProps: { id: 'a' } })
    await waitFor(() => expect(signals).toHaveLength(1))
    rerender({ id: 'b' })
    await waitFor(() => expect(signals).toHaveLength(2))
    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)
    unmount()
    expect(signals[1].aborted).toBe(true)
  })

  it('xato holatini ApiError obyekti sifatida beradi, reload fresh:true bilan qayta yuklaydi', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('x', { status: 503, code: 'UPSTREAM_UNAVAILABLE' }))
      .mockResolvedValueOnce({ ok: 1 })
    const { result } = renderHook(() => useApi(fn, []))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBeNull()
    expect(result.current.error.code).toBe('UPSTREAM_UNAVAILABLE')
    expect(fn.mock.calls[0][0].fresh).toBe(false)

    act(() => result.current.reload())
    expect(result.current).toMatchObject({ loading: true, error: null })
    await waitFor(() => expect(result.current.data).toEqual({ ok: 1 }))
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn.mock.calls[1][0].fresh).toBe(true)
  })

  it('eski imzo: api metodini argumentsiz chaqiruvchi fn ham ishlaydi', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ slug: 'a' }]))
    const { result } = renderHook(() => useApi(() => api.news(), []))
    await waitFor(() => expect(result.current.data).toEqual([{ slug: 'a' }]))
  })

  it('StrictMode: effekt ikki marta ishlasa ham fetch bitta, data to`g`ri', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ issue: { no: 1 } }))
    const { result } = renderHook(() => useApi(o => api.bootstrap(o), []), { wrapper: StrictMode })
    await waitFor(() => expect(result.current.data).toEqual({ issue: { no: 1 } }))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current).toMatchObject({ loading: false, error: null })
  })

  it('reload funksiyasi renderlar orasida barqaror', async () => {
    const { result, rerender } = renderHook(() => useApi(() => Promise.resolve(1), []))
    const first = result.current.reload
    await waitFor(() => expect(result.current.data).toBe(1))
    rerender()
    expect(result.current.reload).toBe(first)
  })
})
