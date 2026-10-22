// Mahkamlangan (pinned) ligalar — localStorage da saqlanadi.
// Bitta tashqi store: `usePins()` (useSyncExternalStore) shu tab va boshqa tablardagi (`storage`) o'zgarishni oladi.
import { useSyncExternalStore } from 'react'

// v2: liga ID lari API-Football (api-sports.io) bo'yicha.
// Qaror: eski `escore-pins` (SofaScore ID lari) ko'chirilmaydi — foydalanuvchi qo'shgan ligalarni yangi
// manba ID lariga ishonchli moslab bo'lmaydi, noto'g'ri ID esa boshqa ligaga olib boradi. Shuning uchun eski
// kalit bir marta o'chiriladi va ro'yxat yangi standartlardan boshlanadi.
const KEY = 'escore-pins:v2'
const LEGACY_KEYS = Object.freeze(['escore-pins'])
const CHANGE_EVENT = 'escore-pins'

// Standart mahkamlangan ligalar (mashhur) — API-Football league ID lari
const DEFAULTS = Object.freeze([
  { id: 39, name: 'Premier League' },
  { id: 140, name: 'LaLiga' },
  { id: 78, name: 'Bundesliga' },
  { id: 135, name: 'Serie A' },
  { id: 61, name: 'Ligue 1' },
  { id: 88, name: 'Eredivisie' },
  { id: 2, name: 'Champions League' },
  { id: 3, name: 'Europa League' },
  { id: 1, name: 'World Cup' },
])

const isValidPin = p => p != null && typeof p === 'object' && p.id != null && p.id !== ''

// Buzilgan/eskirgan yozuvlar (null, id siz) tashlab yuboriladi
function sanitize(list) {
  return Object.freeze(list.filter(isValidPin).map(p => Object.freeze({ id: p.id, name: String(p.name ?? p.id) })))
}

// Eski versiya kalitlarini tashlab yuboradi (bir martalik; kalit yo'q bo'lsa hech narsa qilmaydi)
function dropLegacy() {
  try {
    LEGACY_KEYS.forEach(k => localStorage.removeItem(k))
  } catch (err) {
    console.error("[pins] eski saqlangan ligalarni o'chirib bo'lmadi", err)
  }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw == null) return sanitize(DEFAULTS)
    const v = JSON.parse(raw)
    return Array.isArray(v) ? sanitize(v) : sanitize(DEFAULTS)
  } catch (err) {
    console.error("[pins] saqlangan ligalarni o'qib bo'lmadi", err)
    return sanitize(DEFAULTS)
  }
}

dropLegacy()
let pins = load()

function save(next) {
  pins = sanitize(next)
  try {
    localStorage.setItem(KEY, JSON.stringify(pins))
  } catch (err) {
    // Saqlash taqiqlangan (private rejim/kvota) — joriy sessiyada ishlashda davom etadi
    console.error('[pins] saqlab bo‘lmadi', err)
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function getPins() {
  return pins
}

export function isPinned(id) {
  return pins.some(p => String(p.id) === String(id))
}

export function togglePin(league) {
  if (!isValidPin(league)) return
  if (isPinned(league.id)) save(pins.filter(p => String(p.id) !== String(league.id)))
  else save([...pins, { id: league.id, name: league.name }])
}

export function unpin(id) {
  save(pins.filter(p => String(p.id) !== String(id)))
}

// Barcha obunachilar uchun bitta `storage` va bitta o'zgarish tinglovchisi
const listeners = new Set()
const notify = () => listeners.forEach(fn => fn())
function onStorage(e) {
  if (e.key !== null && e.key !== KEY) return
  pins = load()
  notify()
}

function subscribe(onChange) {
  if (listeners.size === 0) {
    window.addEventListener(CHANGE_EVENT, notify)
    window.addEventListener('storage', onStorage)
  }
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
    if (listeners.size > 0) return
    window.removeEventListener(CHANGE_EVENT, notify)
    window.removeEventListener('storage', onStorage)
  }
}

/** Mahkamlangan ligalar ro'yxati (o'zgarmas massiv). */
export function usePins() {
  return useSyncExternalStore(subscribe, getPins, getPins)
}
