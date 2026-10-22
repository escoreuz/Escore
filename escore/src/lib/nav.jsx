// Yengil History API router: navigate, <Link>, useRoute, parseRoute.
// Tashqi kutubxonasiz (react-router qo'shilmaydi). Eski `#/...` havolalar yangi yo'lga ko'chiriladi.
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'

const NAV_EVENT = 'escore:navigate'
const NOT_FOUND = Object.freeze({ name: 'notFound' })

// Parametrsiz yo'llar
const STATIC_ROUTES = {
  '/': 'home',
  '/score': 'score',
  '/news': 'news',
  '/archive': 'archive',
}

// Bitta parametrli yo'llar: birinchi segment → { name, param }
const PARAM_ROUTES = {
  rankings: { name: 'rankings', param: 'kind' },
  news: { name: 'newsArticle', param: 'slug' },
  match: { name: 'match', param: 'id' },
  league: { name: 'league', param: 'id' },
  team: { name: 'team', param: 'id' },
  player: { name: 'player', param: 'id' },
  coach: { name: 'coach', param: 'id' },
  referee: { name: 'referee', param: 'id' },
  article: { name: 'article', param: 'slug' },
  section: { name: 'section', param: 'section' },
  search: { name: 'search', param: 'query' },
}

const PARAM_PATH_RE = /^\/([a-z]+)\/([^/]+)$/

/**
 * decodeURIComponent, lekin noto'g'ri `%` ketma-ketligida yiqilmaydi — xom satrni qaytaradi.
 * @param {string} str
 * @returns {string}
 */
export function safeDecode(str) {
  try {
    return decodeURIComponent(str)
  } catch {
    // URIError: buzilgan foiz-kodlash — xom qiymat bilan ishlashni davom ettiramiz (sahifa 404/qidiruvni o'zi hal qiladi)
    return str
  }
}

// Bosh `/` ni kafolatlaydi va oxirgi `/` ni olib tashlaydi (ildizdan tashqari)
function normalizePath(pathname) {
  const raw = typeof pathname === 'string' && pathname ? pathname : '/'
  const withSlash = raw.startsWith('/') ? raw : '/' + raw
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, '') || '/' : withSlash
}

/**
 * URL yo'lini marshrut obyektiga aylantiradi. Noma'lum yo'l → { name: 'notFound' }.
 * @param {string} pathname
 * @returns {{ name: string, [param: string]: string }}
 */
export function parseRoute(pathname) {
  const path = normalizePath(pathname)
  if (Object.hasOwn(STATIC_ROUTES, path)) return { name: STATIC_ROUTES[path] }
  const match = path.match(PARAM_PATH_RE)
  if (!match || !Object.hasOwn(PARAM_ROUTES, match[1])) return NOT_FOUND
  const { name, param } = PARAM_ROUTES[match[1]]
  const value = safeDecode(match[2]).trim()
  return value ? { name, [param]: value } : NOT_FOUND
}

// Faqat shu saytdagi mutlaq yo'l (`/...`). `//host` va `\` (brauzerlar `/\host` ni `//host` deb o'qiydi) rad etiladi.
export function isInternalPath(to) {
  return typeof to === 'string' && to.startsWith('/') && !to.startsWith('//') && !to.includes('\\')
}

const isHttpUrl = to => typeof to === 'string' && /^https?:\/\//i.test(to)

function currentLocation() {
  const { pathname, search, hash } = window.location
  return pathname + search + hash
}

/**
 * Ilova ichida sahifa almashtiradi (History API).
 * @param {string} to — `/` bilan boshlanuvchi yo'l; tashqi URL bo'lsa oddiy brauzer o'tishi
 * @param {{ replace?: boolean }} [opts]
 */
export function navigate(to, { replace = false } = {}) {
  if (!isInternalPath(to)) {
    // Tashqi o'tish faqat http(s); javascript:, data:, `\` li yo'llar va h.k. bajarilmaydi
    if (isHttpUrl(to)) window.location.assign(to)
    else console.warn("[nav] xavfsiz bo'lmagan manzilga o'tish rad etildi", to)
    return
  }
  const same = to === currentLocation()
  if (replace || same) window.history.replaceState(window.history.state, '', to)
  else window.history.pushState(null, '', to)
  window.dispatchEvent(new Event(NAV_EVENT))
}

/**
 * Eski `#/...` havolani `history.replaceState` bilan yangi yo'lga o'tkazadi.
 * @returns {boolean} ko'chirish bajarildimi
 */
export function migrateLegacyHash() {
  const { hash } = window.location
  if (!hash.startsWith('#/')) return false
  // `#//host` kabi qiymat boshqa originga olib chiqmasligi uchun bosh slashlar bitta qilinadi
  const target = '/' + hash.slice(1).replace(/\\/g, '/').replace(/^\/+/, '')
  try {
    window.history.replaceState(window.history.state, '', target)
    return true
  } catch (err) {
    console.error("[nav] eski havolani ko'chirib bo'lmadi", err)
    return false
  }
}

function subscribe(onChange) {
  // Hali hash ishlatayotgan komponentlar (2-to'lqingacha) ham ishlashi uchun hashchange tinglanadi
  const onHash = () => {
    migrateLegacyHash()
    onChange()
  }
  window.addEventListener('popstate', onChange)
  window.addEventListener('hashchange', onHash)
  window.addEventListener(NAV_EVENT, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener('hashchange', onHash)
    window.removeEventListener(NAV_EVENT, onChange)
  }
}

const getPathname = () => window.location.pathname

/** Joriy `location.pathname` (sahifa almashganda yangilanadi). */
export function usePathname() {
  return useSyncExternalStore(subscribe, getPathname, () => '/')
}

/** Joriy marshrut: `{ name, ...params }`. */
export function useRoute() {
  const pathname = usePathname()
  return useMemo(() => parseRoute(pathname), [pathname])
}

/**
 * Yo'l almashganda (birinchi yuklanishda EMAS) sahifa boshiga chiqadi va `#main` ga fokus beradi.
 * StrictMode'dagi takroriy effektga chidamli: oldingi yo'l ref'da saqlanadi.
 * @param {string} pathname
 * @param {string} [targetId]
 */
export function useFocusOnRouteChange(pathname, targetId = 'main') {
  const prev = useRef(pathname)
  useEffect(() => {
    if (prev.current === pathname) return
    prev.current = pathname
    window.scrollTo(0, 0)
    document.getElementById(targetId)?.focus({ preventScroll: true })
  }, [pathname, targetId])
}

const isModifiedClick = e => e.metaKey || e.ctrlKey || e.shiftKey || e.altKey

/**
 * Ichki havola: oddiy `<a href>`; oddiy chap bosishda SPA o'tishi, modifikatorli/o'rta tugma — brauzerga.
 * @param {{ to: string, replace?: boolean, onClick?: Function, target?: string, children?: any }} props
 */
export function Link({ to, replace = false, onClick, target, children, ...rest }) {
  const handleClick = e => {
    onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || isModifiedClick(e)) return
    if ((target && target !== '_self') || !isInternalPath(to)) return
    e.preventDefault()
    navigate(to, { replace })
  }
  return (
    <a href={to} target={target} onClick={handleClick} {...rest}>
      {children}
    </a>
  )
}
