// Turnir jadvali uchun sof funksiyalar (UI dan mustaqil). Keshdagi massivlar joyida o'zgartirilmaydi.
// Zona (CL/EL/tushish) server tomonidan berilmaydi — frontend uni o'rin raqamidan taxmin QILMAYDI.
import { DASH } from './shared.js'

const POINTS_WIN = 3
const POINTS_DRAW = 1

const isNum = v => typeof v === 'number' && Number.isFinite(v)

// null qiymatlar oxirida; aks holda kamayish tartibi
const desc = (a, b) => (isNum(b) ? b : -Infinity) - (isNum(a) ? a : -Infinity)

function splitView(s) {
  const known = s && isNum(s.w) && isNum(s.d) && isNum(s.l)
  return {
    P: known ? s.w + s.d + s.l : null,
    W: s?.w ?? null,
    D: s?.d ?? null,
    L: s?.l ?? null,
    Pts: known ? s.w * POINTS_WIN + s.d * POINTS_DRAW : null,
    // Uy/mehmon bo'yicha gollar serverda yo'q — umumiy gollar uydirilmaydi
    GF: null,
    GA: null,
    GD: null,
  }
}

function totalView(r) {
  return {
    pos: r.pos ?? null,
    P: r.P ?? null,
    W: r.total?.w ?? null,
    D: r.total?.d ?? null,
    L: r.total?.l ?? null,
    GF: r.GF ?? null,
    GA: r.GA ?? null,
    GD: r.GD ?? null,
    Pts: r.Pts ?? null,
    form: Array.isArray(r.form) ? r.form : [],
  }
}

/**
 * Jadval qatorlarini ko'rinish modeliga aylantiradi (yangi massiv).
 * split='all' → server tartibi va o'rni; 'home'|'away' → uy/mehmon natijasi bo'yicha qayta saralanadi.
 * @param {object[]} rows server qatorlari
 * @param {'all'|'home'|'away'} split
 */
export function standingsView(rows, split = 'all') {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : []
  const base = r => ({ id: r.id ?? null, name: r.name || '', c: r.c })
  if (split === 'all') return list.map(r => ({ ...base(r), ...totalView(r) }))
  const view = list.map(r => ({ ...base(r), form: [], ...splitView(r[split]) }))
  const sorted = [...view].sort((a, b) => desc(a.Pts, b.Pts) || desc(a.W, b.W) || a.name.localeCompare(b.name))
  return sorted.map((r, i) => ({ ...r, pos: isNum(r.Pts) ? i + 1 : null }))
}

/** Gollar farqi klassi va matni (+3 / -2 / 0 / —). */
export function goalDiff(gd) {
  if (!isNum(gd)) return { cls: '', text: DASH }
  if (gd > 0) return { cls: 'lg-gd-pos', text: `+${gd}` }
  if (gd < 0) return { cls: 'lg-gd-neg', text: String(gd) }
  return { cls: '', text: '0' }
}

/**
 * Guruhlar ro'yxati: `groups` bo'sh bo'lsa `rows` bitta guruh sifatida.
 * @param {{ groups?: object[], rows?: object[] }} data
 */
export function groupsOf(data) {
  if (Array.isArray(data?.groups) && data.groups.length) return data.groups
  const rows = Array.isArray(data?.rows) ? data.rows : []
  return rows.length ? [{ name: '', rows }] : []
}
