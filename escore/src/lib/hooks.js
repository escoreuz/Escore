// Umumiy React hook'lar: debounce, sahifa ko'rinishi, polling
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

// Juda tez polling serverni ortiqcha yuklamasligi uchun pastki chegara
export const MIN_POLL_MS = 1000

/**
 * Qiymatni `ms` davomida o'zgarmasa qaytaradi.
 * @template T
 * @param {T} value
 * @param {number} ms
 * @returns {T}
 */
export function useDebounce(value, ms) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

function subscribeVisibility(onChange) {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}

const isPageVisible = () => document.visibilityState !== 'hidden'

/** Brauzer tabi ko'rinib turibdimi (`document.visibilityState`). */
export function usePageVisible() {
  return useSyncExternalStore(subscribeVisibility, isPageVisible, () => true)
}

/**
 * `fn` ni har `ms` da chaqiradi. Sahifa yashirin bo'lsa to'xtaydi, qayta ko'ringanda darhol chaqiradi.
 * Chaqiruvlar ustma-ust tushmaydi: keyingisi oldingi Promise tugagach rejalashtiriladi.
 * @param {() => unknown} fn
 * @param {number} ms
 * @param {{ enabled?: boolean }} [opts]
 */
export function usePolling(fn, ms, { enabled = true } = {}) {
  const fnRef = useRef(fn)
  const visible = usePageVisible()
  const wasVisible = useRef(visible)
  // Effektlar qayta ishga tushganda ham (yashirin → ko'rinadigan) oldingi chaqiruv tugamaguncha yangisi boshlanmaydi
  const inFlight = useRef(false)

  useEffect(() => {
    fnRef.current = fn
  })

  useEffect(() => {
    const becameVisible = visible && !wasVisible.current
    wasVisible.current = visible
    if (!enabled || !visible || !Number.isFinite(ms) || ms <= 0) return undefined
    const interval = Math.max(ms, MIN_POLL_MS)
    let timer = null
    let cancelled = false
    const run = async () => {
      if (!inFlight.current) {
        inFlight.current = true
        try {
          await fnRef.current()
        } catch (err) {
          console.error('[usePolling]', err)
        } finally {
          inFlight.current = false
        }
      }
      if (!cancelled) timer = setTimeout(run, interval)
    }
    if (becameVisible) run()
    else timer = setTimeout(run, interval)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [enabled, visible, ms])
}
