// Murabbiy va hakam sahifalari.
// Upstream bermagan raqamlar (kubok, penalti, karyera bo'yicha o'yin/ochko) — null (uydirma nol yo'q).

import { ageFrom, arr, colorOf, flagEmoji, mapEvents } from './format.js'
import { invalidResponse, j } from './http.js'
import { createPartial } from './log.js'

/** Asosiy obyekt + so'nggi o'yinlar (parallel). O'yinlar 404 → [], boshqa xato → [] + unavailable. */
async function loadWithMatches(kind, id, field) {
  const part = createPartial(`${kind}/${id}`)
  const [main, last] = await Promise.all([
    j(`/${kind}/${id}`),
    part.settle(j(`/${kind}/${id}/events/last`), 'matches', null),
  ])
  const obj = main[field]
  if (!obj || typeof obj !== 'object') throw invalidResponse(`/${kind}/${id}`)
  const matches = mapEvents(last?.events, `${kind}/${id}/events/last`).reverse()
  return { obj, matches, meta: { unavailable: part.unavailable } }
}

const num = v => (Number.isFinite(v) ? v : null)

function coachRecord(perf) {
  const total = num(perf.total)
  const w = num(perf.wins)
  const d = num(perf.draws)
  const l = num(perf.losses)
  const pts = num(perf.totalPoints)
  const ppg = total && pts != null ? (pts / total).toFixed(2) : null
  const winPct = total && w != null ? Math.round((w / total) * 100) : null
  return { games: total, w, d, l, ppg, winPct }
}

// ---- Murabbiy sahifasi (real) ----
export async function coach(id) {
  const { obj: m, matches, meta } = await loadWithMatches('managers', id, 'manager')
  const record = coachRecord(m.performance || {})
  const career = arr(m.teams)
    .filter(tm => tm && typeof tm === 'object')
    .map(tm => ({
      club: tm.name,
      id: tm.id ?? null,
      c: colorOf(tm),
      from: null,
      to: null,
      games: null,
      ppg: null,
      trophies: null,
    }))

  return {
    name: m.name,
    id: m.id,
    team: m.team?.name || m.teams?.[0]?.name || null,
    teamId: m.team?.id || m.teams?.[0]?.id || null,
    teamColor: colorOf(m.team),
    flag: flagEmoji(m.country?.alpha2 || m.nationalityISO2),
    country: m.country?.name || m.nationality || null,
    age: ageFrom(m.dateOfBirthTimestamp),
    formation: m.preferredFormation || null,
    totalGames: record.games,
    totalTrophies: null,
    record,
    career,
    matches,
    meta,
  }
}

// ---- Hakam sahifasi (real) ----
export async function referee(id) {
  const { obj: r, matches, meta } = await loadWithMatches('referees', id, 'referee')
  const apps = num(r.games)
  const yellow = num(r.yellowCards)
  const red = r.redCards == null && r.yellowRedCards == null ? null : (r.redCards || 0) + (r.yellowRedCards || 0)
  const flag = flagEmoji(r.country?.alpha2)

  return {
    name: r.name,
    id: r.id,
    flag,
    country: r.country?.name || null,
    age: ageFrom(r.dateOfBirthTimestamp),
    totals: { apps, yellow, red, pen: null },
    career: [
      {
        id: null,
        flag,
        name: 'Umumiy karyera',
        apps,
        avgYellow: apps && yellow != null ? (yellow / apps).toFixed(2) : null,
        red,
        pen: null,
      },
    ],
    matches,
    meta,
  }
}
