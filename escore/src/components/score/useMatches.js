// O'yinlar ro'yxati: sana/holat/qidiruv bo'yicha yuklash + faqat bugun uchun polling.
// Natija so'rov kaliti bilan saqlanadi — sana/tab almashganda eski ro'yxat bir kadr ham ko'rinmaydi.
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, isAbortError } from '../../api.js'
import { usePolling } from '../../lib/hooks.js'
import { describeChanges, pollInterval } from './matchText.js'

const EMPTY = Object.freeze({ data: null, error: null, updatedAt: null, announcement: '' })
const NO_MATCHES = Object.freeze([])

function normalize(data) {
  return {
    matches: Array.isArray(data?.matches) ? data.matches : NO_MATCHES,
    liveCount: Number.isFinite(data?.liveCount) ? data.liveCount : 0,
    partial: data?.partial === true,
  }
}

// Kalitli natija holati: muvaffaqiyat (e'lon matni bilan), xato (eski ro'yxat saqlanadi), xatoni tozalash
function useKeyedResult() {
  const [state, setState] = useState({ key: null, ...EMPTY })
  const lastRef = useRef({ key: null, matches: null })

  const apply = useCallback((reqKey, raw) => {
    const data = normalize(raw)
    const prev = lastRef.current.key === reqKey ? lastRef.current.matches : null
    lastRef.current = { key: reqKey, matches: data.matches }
    setState({
      key: reqKey,
      data,
      error: null,
      updatedAt: Date.now(),
      announcement: describeChanges(prev, data.matches),
    })
  }, [])

  const fail = useCallback((reqKey, error) => {
    setState(s => ({ ...(s.key === reqKey ? s : EMPTY), key: reqKey, error, announcement: '' }))
  }, [])

  const clearError = useCallback(() => setState(s => ({ ...s, error: null })), [])
  return { state, apply, fail, clearError }
}

function toPublic(key, current, reload) {
  const data = current?.data ?? null
  return {
    matches: data?.matches ?? NO_MATCHES,
    liveCount: data?.liveCount ?? 0,
    partial: data?.partial ?? false,
    hasData: data != null,
    error: current?.error ?? null,
    loading: key == null || (data == null && current?.error == null),
    updatedAt: current?.updatedAt ?? null,
    announcement: current?.announcement ?? '',
    reload,
  }
}

/**
 * @param {{ date: string|null, status: string, q: string, isToday: boolean }} params
 */
export function useMatches({ date, status, q, isToday }) {
  const key = date ? JSON.stringify([date, status, q]) : null
  const { state, apply, fail, clearError } = useKeyedResult()
  const [nonce, setNonce] = useState(0)
  const pollCtrlRef = useRef(null)
  const isTodayRef = useRef(isToday)
  useEffect(() => {
    isTodayRef.current = isToday
  })

  const request = useCallback(
    async (reqKey, opts) => {
      try {
        const raw = await api.matches({ date, status, q }, opts)
        if (!opts.signal.aborted) apply(reqKey, raw)
      } catch (err) {
        if (!opts.signal.aborted && !isAbortError(err)) fail(reqKey, err)
      }
    },
    [date, status, q, apply, fail],
  )

  useEffect(() => {
    if (!key) return undefined
    const controller = new AbortController()
    // Bugungi jonli ro'yxat 30 s lik keshdan olinmaydi
    request(key, { signal: controller.signal, fresh: nonce > 0 || isTodayRef.current })
    return () => {
      controller.abort()
      pollCtrlRef.current?.abort()
    }
  }, [key, nonce, request])

  const current = state.key === key ? state : null
  usePolling(
    () => {
      if (!key) return undefined
      const controller = new AbortController()
      pollCtrlRef.current = controller
      return request(key, { signal: controller.signal, fresh: true })
    },
    pollInterval(current?.data?.liveCount ?? 0),
    { enabled: Boolean(key) && isToday },
  )

  const reload = useCallback(() => {
    clearError()
    setNonce(n => n + 1)
  }, [clearError])

  return toPublic(key, current, reload)
}
