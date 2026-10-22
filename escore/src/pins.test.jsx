import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const KEY = 'escore-pins:v2'
const LEGACY_KEY = 'escore-pins'

async function freshModule() {
  vi.resetModules()
  return import('./pins.js')
}

beforeEach(() => {
  localStorage.clear()
})

describe('pins store', () => {
  it('standart ro‘yxat API-Football liga ID lari bilan', async () => {
    const pins = await freshModule()
    expect(pins.getPins().map(p => p.id)).toEqual([39, 140, 78, 135, 61, 88, 2, 3, 1])
    expect(pins.getPins().map(p => p.name)).toContain('Champions League')
  })

  it('eski `escore-pins` (SofaScore ID) o‘qilmaydi va o‘chiriladi', async () => {
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify([
        { id: 17, name: 'Premier League' },
        { id: 999, name: 'Eski' },
      ]),
    )
    const pins = await freshModule()
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
    expect(pins.isPinned(17)).toBe(false)
    expect(pins.isPinned(999)).toBe(false)
    expect(pins.isPinned(39)).toBe(true)
  })

  it('saqlangan massivdagi null/id siz elementlarda yiqilmaydi', async () => {
    localStorage.setItem(KEY, JSON.stringify([null, { name: 'idsiz' }, { id: 39, name: 'Premier League' }, 5]))
    const pins = await freshModule()
    expect(pins.getPins()).toEqual([{ id: 39, name: 'Premier League' }])
    expect(pins.isPinned(39)).toBe(true)
    expect(pins.isPinned(null)).toBe(false)
  })

  it('buzilgan JSON → standart ro‘yxat', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem(KEY, '{buzuq')
    const pins = await freshModule()
    expect(pins.getPins().length).toBeGreaterThan(0)
    console.error.mockRestore()
  })

  it('usePins togglePin/unpin ga va boshqa tabdagi storage hodisasiga javob beradi', async () => {
    localStorage.setItem(KEY, JSON.stringify([]))
    const pins = await freshModule()
    const { result } = renderHook(() => pins.usePins())
    expect(result.current).toEqual([])

    act(() => pins.togglePin({ id: 140, name: 'LaLiga' }))
    expect(result.current).toEqual([{ id: 140, name: 'LaLiga' }])
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual([{ id: 140, name: 'LaLiga' }])

    act(() => pins.togglePin(null))
    expect(result.current).toHaveLength(1)

    localStorage.setItem(KEY, JSON.stringify([{ id: 78, name: 'Bundesliga' }, null]))
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: KEY })))
    expect(result.current).toEqual([{ id: 78, name: 'Bundesliga' }])

    act(() => pins.unpin(78))
    expect(result.current).toEqual([])
  })
})

describe('pins — ko‘p obunachi', () => {
  it('ikki obunachi o‘zgarishni oladi; oxirgisi ketganda window tinglovchilari olinadi', async () => {
    localStorage.setItem(KEY, JSON.stringify([]))
    const pins = await freshModule()
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const a = renderHook(() => pins.usePins())
    const b = renderHook(() => pins.usePins())
    const storageAdds = () => addSpy.mock.calls.filter(([type]) => type === 'storage').length
    const storageRemoves = () => removeSpy.mock.calls.filter(([type]) => type === 'storage').length
    expect(storageAdds()).toBe(1)

    act(() => pins.togglePin({ id: 140, name: 'LaLiga' }))
    expect(a.result.current).toHaveLength(1)
    expect(b.result.current).toHaveLength(1)

    a.unmount()
    expect(storageRemoves()).toBe(0)
    act(() => pins.unpin(140))
    expect(b.result.current).toEqual([])

    b.unmount()
    expect(storageRemoves()).toBe(1)
    expect(removeSpy.mock.calls.filter(([type]) => type === 'escore-pins')).toHaveLength(1)
    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
