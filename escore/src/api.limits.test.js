// api.js: konfiguratsiya, buzuq javob, kesh chegarasi, obunachilar va server marshrutlari bilan moslik
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api, ApiError, clearApiCache, isAbortError, CACHE_MAX_ENTRIES } from './api.js'

const jsonType = 'application/json; charset=utf-8'
const jsonResponse = (body, status = 200, json = async () => body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: name => (name.toLowerCase() === 'content-type' ? jsonType : null) },
  json,
})
const hangingFetch = () =>
  vi.fn(
    (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
      }),
  )
const flushMicrotasks = () => new Promise(r => setTimeout(r, 0))

let fetchMock
beforeEach(() => {
  clearApiCache()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('production konfiguratsiyasi', () => {
  it('VITE_API_URL bo`lmasa base null, get() CONFIG bilan rad etadi, fetch chaqirilmaydi', async () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_API_URL', '')
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.resetModules()
    const mod = await import('./api.js')
    expect(mod.api.base).toBeNull()
    expect(mod.api.img('team', 1)).toBeNull()
    const err = await mod.api.home().catch(e => e)
    expect(err).toBeInstanceOf(mod.ApiError)
    expect(err.code).toBe('CONFIG')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith('[api]', expect.stringContaining('VITE_API_URL'))
  })
})

describe('javobni o`qish', () => {
  it('application/json, lekin buzuq tana → BAD_RESPONSE', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(null, 200, async () => {
        throw new SyntaxError('Unexpected end of JSON input')
      }),
    )
    const err = await api.news().catch(e => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('BAD_RESPONSE')
    expect(err.cause).toBeInstanceOf(SyntaxError)
  })

  it('prototip kalitli code (constructor/__proto__) xabarni buzmaydi', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'constructor' }, 500))
    const err = await api.news().catch(e => e)
    expect(err.code).toBe('constructor')
    expect(typeof err.message).toBe('string')
    expect(err.message).toBe("So'rov bajarilmadi")
  })
})

describe('kesh chegarasi va o`zgarmasligi', () => {
  it(`${CACHE_MAX_ENTRIES} yozuvdan oshsa eng eski yozilgan yozuv chiqariladi (FIFO)`, async () => {
    fetchMock.mockImplementation(async url => jsonResponse({ url }))
    for (let i = 0; i <= CACHE_MAX_ENTRIES; i += 1) await api.match(i)
    expect(fetchMock).toHaveBeenCalledTimes(CACHE_MAX_ENTRIES + 1)
    await api.match(CACHE_MAX_ENTRIES) // eng yangisi keshda
    expect(fetchMock).toHaveBeenCalledTimes(CACHE_MAX_ENTRIES + 1)
    await api.match(0) // eng eskisi chiqarilgan
    expect(fetchMock).toHaveBeenCalledTimes(CACHE_MAX_ENTRIES + 2)
  })

  it('keshdagi qiymat sayoz muzlatilgan', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [1] }))
    const data = await api.feed()
    expect(Object.isFrozen(data)).toBe(true)
    expect(() => {
      'use strict'
      data.items = []
    }).toThrow(TypeError)
  })
})

describe('obunachilar', () => {
  it('hamma obunachi ketsa tarmoq so`rovi bekor qilinadi, keyingi chaqiruv yangi so`rov boshlaydi', async () => {
    fetchMock.mockImplementation(hangingFetch())
    const a = new AbortController()
    const b = new AbortController()
    const pa = api.team(5, { signal: a.signal }).catch(e => e)
    const pb = api.team(5, { signal: b.signal }).catch(e => e)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    a.abort()
    await flushMicrotasks()
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false)
    b.abort()
    await flushMicrotasks()
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
    expect(isAbortError(await pa)).toBe(true)
    expect(isAbortError(await pb)).toBe(true)
    api.team(5).catch(() => {})
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('abort tinglovchisi muvaffaqiyatda ham, abortda ham olib tashlanadi', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: 1 }))
    const ok = new AbortController()
    const addOk = vi.spyOn(ok.signal, 'addEventListener')
    const removeOk = vi.spyOn(ok.signal, 'removeEventListener')
    await api.coach(1, { signal: ok.signal })
    expect(removeOk).toHaveBeenCalledWith('abort', addOk.mock.calls[0][1])

    fetchMock.mockImplementation(hangingFetch())
    const ab = new AbortController()
    const addAb = vi.spyOn(ab.signal, 'addEventListener')
    const removeAb = vi.spyOn(ab.signal, 'removeEventListener')
    const p = api.coach(2, { signal: ab.signal }).catch(e => e)
    ab.abort()
    await p
    expect(removeAb).toHaveBeenCalledWith('abort', addAb.mock.calls[0][1])
  })
})

describe('server marshrutlari bilan moslik (server/app.js)', () => {
  it.each([
    ['bootstrap', () => api.bootstrap(), '/api/bootstrap'],
    ['home', () => api.home(), '/api/home'],
    ['news', () => api.news(), '/api/news'],
    ['article', () => api.article('a-b'), '/api/news/a-b'],
    ['search', () => api.search('messi'), '/api/search?q=messi'],
    ['feed', () => api.feed(), '/api/feed'],
    ['newsArticle', () => api.newsArticle('x'), '/api/feed/x'],
    ['countries', () => api.countries(), '/api/countries'],
    ['countryLeagues', () => api.countryLeagues(3), '/api/countries/3/leagues'],
    ['rankings', () => api.rankings('fifa'), '/api/rankings/fifa'],
    ['days', () => api.days(), '/api/days'],
    ['featured', () => api.featured(), '/api/featured'],
    ['scorers', () => api.scorers(), '/api/scorers'],
    ['standingsMini', () => api.standingsMini(), '/api/standings-mini'],
    ['league', () => api.league(17, 61627), '/api/leagues/17?season=61627'],
    ['team', () => api.team(42), '/api/teams/42'],
    ['player', () => api.player(7), '/api/players/7'],
    ['playerCareer', () => api.playerCareer(7), '/api/players/7/career'],
    ['playerSeason', () => api.playerSeason(7, 17, 61627), '/api/players/7/season?tid=17&sid=61627'],
    ['coach', () => api.coach(9), '/api/coaches/9'],
    ['referee', () => api.referee(11), '/api/referees/11'],
  ])('%s → to`g`ri URL', async (_name, call, path) => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    await call()
    expect(fetchMock.mock.calls[0][0]).toBe(api.base + path)
  })
})
