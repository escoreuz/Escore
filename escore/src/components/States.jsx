// Yuklanish / xato / bo'sh holat komponentlari va useApi natijasi uchun AsyncView
import { useEffect, useRef, useState } from 'react'
import logoUrl from '../assets/logo.svg'

const FALLBACK_TEXT = "Ma'lumotni yuklab bo'lmadi. Birozdan keyin qayta urinib ko'ring."
const OFFLINE_TEXT = "Server bilan aloqa yo'q. Internet aloqasini tekshirib, qayta urinib ko'ring."
const CONFIG_TEXT = "Sayt sozlamasida xatolik: API manzili noto'g'ri sozlangan."

// Xato kodi → foydalanuvchiga ko'rinadigan matn. Ichki tafsilot (port, stack, URL) hech qachon chiqmaydi.
const ERROR_TEXT = {
  UPSTREAM_UNAVAILABLE: "Ma'lumot manbai vaqtincha ishlamayapti. Birozdan keyin qayta urinib ko'ring.",
  NOT_FOUND: "So'ralgan ma'lumot topilmadi.",
  NETWORK: OFFLINE_TEXT,
  TIMEOUT: OFFLINE_TEXT,
  BAD_RESPONSE: CONFIG_TEXT,
  CONFIG: CONFIG_TEXT,
  BAD_REQUEST: "So'rov noto'g'ri. Manzilni tekshiring.",
  RATE_LIMITED: "So'rovlar juda ko'p. Birozdan keyin qayta urinib ko'ring.",
  UNAUTHORIZED: "Bu amal uchun ruxsat yo'q.",
  FORBIDDEN: "Bu amal uchun ruxsat yo'q.",
}

/**
 * Xatoni foydalanuvchi matniga aylantiradi.
 * Satr — chaqiruvchi yozgan tayyor matn (masalan "Maqola topilmadi"); obyekt — faqat `code` bo'yicha.
 * @param {unknown} error
 * @returns {string}
 */
export function errorText(error) {
  if (typeof error === 'string' && error.trim()) return error
  const code = error && typeof error === 'object' ? error.code : undefined
  // Object.hasOwn: '__proto__', 'constructor' kabi kodlar prototipdan qiymat olmasin
  return typeof code === 'string' && Object.hasOwn(ERROR_TEXT, code) ? ERROR_TEXT[code] : FALLBACK_TEXT
}

// autoFocus: element paydo bo'lganda fokusni o'ziga oladi (tabIndex=-1). "Qayta urinish" tugmasi
// yo'qolganda fokus <body> ga tushib ketmasligi uchun AsyncView ishlatadi.
function useAutoFocus(enabled) {
  const ref = useRef(null)
  useEffect(() => {
    if (enabled) ref.current?.focus()
  }, [enabled])
  return { ref, tabIndex: enabled ? -1 : undefined }
}

export function Loading({ label = 'Yuklanmoqda…', autoFocus = false }) {
  const focus = useAutoFocus(autoFocus)
  return (
    <div className="state state--loading" role="status" aria-live="polite" {...focus}>
      <img className="state__logo" src={logoUrl} alt="" aria-hidden="true" width="66" height="66" />
      <span className="state__label">{label}</span>
    </div>
  )
}

/**
 * Xato bloki. `error` — useApi/ApiError obyekti yoki tayyor matn.
 * `message` — eski imzo bilan moslik uchun (`<ErrorBox message={error} />`), `error` bilan bir xil ishlaydi.
 * `onRetry` berilsa "Qayta urinish" tugmasi chiqadi.
 */
export function ErrorBox({
  error,
  message,
  onRetry,
  title = "Ma'lumotni yuklab bo'lmadi",
  level = 2,
  autoFocus = false,
}) {
  const Heading = level === 1 ? 'h1' : 'h2'
  const focus = useAutoFocus(autoFocus)
  return (
    <div className="state state--error" role="alert" {...focus}>
      <p className="kicker">XATOLIK</p>
      <Heading className="lead__title">{title}</Heading>
      <p className="state__msg">{errorText(error ?? message)}</p>
      {onRetry && (
        <button type="button" className="state__retry" onClick={onRetry}>
          Qayta urinish
        </button>
      )}
    </div>
  )
}

export function Empty({ children = "Hozircha ma'lumot yo'q." }) {
  return <div className="state state--empty">{children}</div>
}

const defaultIsEmpty = data => data == null || (Array.isArray(data) && data.length === 0)

/**
 * useApi natijasini holatlarga ajratib chizadi.
 * "Qayta urinish" bosilgach fokus Loading (keyin xato takrorlansa ErrorBox) konteyneriga o'tadi.
 * @param {{ data: any, error: any, loading: boolean, reload?: () => void }} props.state
 * @param {(data: any) => import('react').ReactNode | import('react').ReactNode} props.children
 * @param {import('react').ReactNode} [props.empty] bo'sh holat matni
 * @param {(data: any) => boolean} [props.isEmpty]
 */
export function AsyncView({ state, children, empty, loadingText, isEmpty = defaultIsEmpty }) {
  const { data, error, loading, reload } = state
  const [retried, setRetried] = useState(false)
  // Muvaffaqiyatli yuklangach bayroq tushiriladi — keyingi oddiy yuklanishlar fokusni o'g'irlamasin
  if (retried && !loading && !error) setRetried(false)
  const retry = reload
    ? () => {
        setRetried(true)
        reload()
      }
    : undefined
  if (error) return <ErrorBox error={error} onRetry={retry} autoFocus={retried} />
  if (loading && data == null) return <Loading label={loadingText} autoFocus={retried} />
  if (isEmpty(data)) return <Empty>{empty}</Empty>
  return typeof children === 'function' ? children(data) : children
}
