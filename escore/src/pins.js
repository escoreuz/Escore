// Mahkamlangan (pinned) ligalar — localStorage da saqlanadi.
// O'zgarganda 'escore-pins' eventi tarqaladi (komponentlar yangilanadi).

const KEY = 'escore-pins'

// Standart mahkamlangan ligalar (mashhur)
const DEFAULTS = [
  { id: 17, name: 'Premier League' },
  { id: 8, name: 'LaLiga' },
  { id: 35, name: 'Bundesliga' },
  { id: 23, name: 'Serie A' },
  { id: 34, name: 'Ligue 1' },
  { id: 37, name: 'Eredivisie' },
  { id: 7, name: 'Champions League' },
  { id: 679, name: 'Europa League' },
  { id: 16, name: 'World Cup' },
]

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(v) ? v : DEFAULTS
  } catch { return DEFAULTS }
}

let pins = load()

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(pins)) } catch { /* ignore */ }
  window.dispatchEvent(new Event('escore-pins'))
}

export function getPins() { return pins }
export function isPinned(id) { return pins.some((p) => String(p.id) === String(id)) }

export function togglePin(league) {
  if (isPinned(league.id)) {
    pins = pins.filter((p) => String(p.id) !== String(league.id))
  } else {
    pins = [...pins, { id: league.id, name: league.name }]
  }
  save()
}

export function unpin(id) {
  pins = pins.filter((p) => String(p.id) !== String(id))
  save()
}
