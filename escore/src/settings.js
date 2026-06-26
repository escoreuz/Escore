// Sayt sozlamalari: mavzu (light/dark) va vaqt mintaqasi (timezone).
// localStorage da saqlanadi; o'zgarganda 'esocre-settings' eventi tarqaladi.

const KEY = 'esocre-settings'

export const TIMEZONES = [
  { id: 'auto', label: 'Avtomatik (qurilma)' },
  { id: 'Asia/Tashkent', label: "Toshkent · UTC+5" },
  { id: 'Asia/Almaty', label: 'Almati · UTC+5' },
  { id: 'Asia/Dubai', label: 'Dubay · UTC+4' },
  { id: 'Europe/Moscow', label: 'Moskva · UTC+3' },
  { id: 'Europe/Istanbul', label: 'Istanbul · UTC+3' },
  { id: 'Europe/Madrid', label: 'Madrid · UTC+1' },
  { id: 'Europe/London', label: 'London · UTC+0' },
  { id: 'America/New_York', label: 'Nyu-York · UTC-5' },
  { id: 'UTC', label: 'UTC' },
]

const DEFAULTS = { theme: 'light', tz: 'auto' }

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') } }
  catch { return { ...DEFAULTS } }
}

let current = load()

export function getSettings() { return current }

export function setSettings(patch) {
  current = { ...current, ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(current)) } catch { /* ignore */ }
  applyTheme()
  window.dispatchEvent(new Event('esocre-settings'))
}

export function applyTheme() {
  document.documentElement.setAttribute('data-theme', current.theme || 'light')
}

// Unix timestamp (sekund) ni tanlangan mintaqada HH:MM ko'rinishida formatlaydi
export function fmtTime(ts) {
  if (!ts) return null
  const opts = { hour: '2-digit', minute: '2-digit', hour12: false }
  if (current.tz && current.tz !== 'auto') opts.timeZone = current.tz
  try { return new Intl.DateTimeFormat('en-GB', opts).format(new Date(ts * 1000)) }
  catch { return null }
}

// O'yin vaqti: ts bo'lsa mintaqa bo'yicha, bo'lmasa serverdagi tayyor matn
export function matchTime(m) {
  return (m && m.ts && fmtTime(m.ts)) || (m && m.time) || ''
}

// Dastlabki yuklanishda mavzuni qo'llaymiz
applyTheme()
