// O'yinchi sahifasi, karerasi va tanlangan liga mavsumi.

import { NotFoundError, UpstreamError } from '../errors.js'
import { dateStr, dayKey } from './dates.js'
import { ageFrom, arr, birthUz, colorOf, flagEmoji, followersText, isUsableEvent, ratingText } from './format.js'
import { invalidResponse, j } from './http.js'
import { mapSettledLimit } from './limiter.js'
import { createPartial, logPartial } from './log.js'
import {
  attrsFrom,
  marketValueText,
  monthlyRatings,
  playerSide,
  ratingsByDay,
  recentMatches,
  seasonsListFrom,
  seasonTotals,
  statRowsFrom,
} from './player-mappers.js'

const POS_LABEL = { G: 'Darvozabon', D: 'Himoyachi', M: 'Yarim himoyachi', F: 'Hujumchi' }
const CAREER_MAX_SEASONS = 16 // API chaqiruvlarini cheklash
const CAREER_CONCURRENCY = 4 // bir vaqtda ko'pi bilan 4 ta so'rov
const SEASON_EVENT_PAGES = [0, 1, 2]
const MILLION = 1e6
const STRENGTH_COUNT = 2
// Statistika 404 (o'yinchi bu mavsumda maydonga tushmagan) — haqiqiy nollar
const NO_APPEARANCES = Object.freeze({
  appearances: 0,
  matchesStarted: 0,
  minutesPlayed: 0,
  goals: 0,
  assists: 0,
  saves: 0,
  cleanSheet: 0,
  goalsConceded: 0,
})

/** O'yinchi asosiy obyekti: 404 → NotFoundError, yaroqsiz javob → UpstreamError. */
async function loadPlayer(id) {
  const pd = await j(`/players/${id}`)
  if (!pd.player || typeof pd.player !== 'object') throw invalidResponse(`/players/${id}`)
  return pd.player
}

/** Eng so'nggi turnir mavsumi statistikasi (xulosa + jadval). Ma'lumot yo'q bo'lsa bo'sh. */
async function latestSeasonStats(id, seasonsData, isGK, part) {
  const empty = { rating: null, seasonSummary: null, statRows: [] }
  const uts = arr(seasonsData?.uniqueTournamentSeasons)[0]
  const season = arr(uts?.seasons)[0]
  if (uts?.uniqueTournament?.id == null || season?.id == null) return empty
  const tid = uts.uniqueTournament.id
  const [ss, hm] = await Promise.allSettled([
    j(`/players/${id}/statistics/${tid}/${season.id}`),
    j(`/players/${id}/heatmap/${tid}/${season.id}`),
  ])
  const statsData = part.take(ss, 'season', null)
  if (!statsData) return empty
  const s = statsData.statistics || {}
  const rating = ratingText(s)
  const heatmap = arr(part.take(hm, 'heatmap', null)?.points)
  return {
    rating,
    seasonSummary: {
      tournament: uts.uniqueTournament.name,
      tournamentId: tid,
      season: season.year,
      heatmap,
      ...seasonTotals(s, isGK),
    },
    statRows: statRowsFrom(s, `${uts.uniqueTournament.name} ${season.year}`, rating),
  }
}

function baseInfo(p) {
  return {
    number: p.jerseyNumber || null,
    flag: flagEmoji(p.country?.alpha2),
    country: p.country?.name || null,
    age: ageFrom(p.dateOfBirthTimestamp),
    birth: birthUz(p.dateOfBirthTimestamp),
    height: p.height || null,
    foot: p.preferredFoot || null,
  }
}

/** Kuchli/zaif tomonlar — faqat atributlar mavjud bo'lsa. */
function strengthsOf(attrs) {
  const known = attrs.filter(a => a.val != null).sort((a, b) => b.val - a.val)
  if (!known.length) return { strengths: [], weaknesses: [] }
  return {
    strengths: known.slice(0, STRENGTH_COUNT).map(a => a.label),
    weaknesses: known.slice(-STRENGTH_COUNT).map(a => a.label),
  }
}

export async function player(id) {
  const p = await loadPlayer(id)
  const part = createPartial(`players/${id}`)
  const [ao, seasons, last, lyr] = await Promise.allSettled([
    j(`/players/${id}/attribute-overviews`),
    j(`/players/${id}/statistics/seasons`),
    j(`/players/${id}/events/last`),
    j(`/players/${id}/last-year-summary`),
  ])
  const seasonsData = part.take(seasons, 'seasons', null)
  const summary = part.take(lyr, 'monthly', null)?.summary
  const lastEvents = part.take(last, 'recent', null)?.events
  const attrs = attrsFrom(part.take(ao, 'attrs', null))
  const st = await latestSeasonStats(id, seasonsData, p.position === 'G', part)
  const rawVal = p.proposedMarketValueRaw?.value || 0

  return {
    name: p.name,
    id: p.id,
    team: p.team?.name || null,
    teamId: p.team?.id || null,
    teamColor: colorOf(p.team),
    posLabel: POS_LABEL[p.position] || p.position || '',
    overall: st.rating,
    rating: st.rating,
    value: rawVal ? Math.round(rawVal / MILLION) : null,
    valueText: marketValueText(rawVal),
    monthly: summary ? monthlyRatings(summary) : [],
    seasonSummary: st.seasonSummary,
    seasonsList: seasonsListFrom(seasonsData),
    followers: followersText(p.userCount),
    base: baseInfo(p),
    attrs,
    ...strengthsOf(attrs),
    stats: st.statRows,
    recent: lastEvents ? recentMatches(lastEvents, p, ratingsByDay(summary)) : [],
    meta: { unavailable: part.unavailable },
  }
}

// ---- O'yinchi karerasi (mavsumma-mavsum jadval) ----
function careerTasks(seasonsData) {
  return arr(seasonsData?.uniqueTournamentSeasons)
    .filter(u => u?.uniqueTournament?.id != null)
    .flatMap(u =>
      arr(u.seasons).map(s => ({
        tid: u.uniqueTournament.id,
        sid: s?.id,
        tName: u.uniqueTournament.name,
        year: s?.year,
        teamId: u.team?.id,
      })),
    )
    .filter(t => t.sid != null)
}

function careerRow({ tName, year, teamId, s }) {
  return {
    year,
    tournament: tName,
    teamId,
    mp: s.appearances ?? null,
    min: s.minutesPlayed ?? null,
    rating: ratingText(s),
    cls: s.cleanSheet ?? null,
    gc: s.goalsConceded ?? null,
    goals: s.goals ?? null,
    assists: s.assists ?? null,
  }
}

/**
 * Karera: hammasi yiqilsa (upstream) → UpstreamError; qisman → partial + failedSeasons;
 * 16 dan ko'p mavsum kesilsa → truncated.
 */
export async function playerCareer(id) {
  const [p, seas] = await Promise.all([loadPlayer(id), j(`/players/${id}/statistics/seasons`)])
  const all = careerTasks(seas)
  const tasks = all.slice(0, CAREER_MAX_SEASONS)
  const results = await mapSettledLimit(tasks, CAREER_CONCURRENCY, t =>
    j(`/players/${id}/statistics/${t.tid}/${t.sid}`).then(r => ({ ...t, s: r.statistics || {} })),
  )
  const failedIdx = results.flatMap((r, i) =>
    r.status === 'rejected' && !(r.reason instanceof NotFoundError) ? [i] : [],
  )
  const unknown = results.find(
    r => r.status === 'rejected' && !(r.reason instanceof UpstreamError || r.reason instanceof NotFoundError),
  )
  if (unknown) throw unknown.reason
  const okCount = results.filter(r => r.status === 'fulfilled').length
  if (failedIdx.length && okCount === 0) {
    throw new UpstreamError(`o'yinchi karerasi yuklanmadi: ${id}`, { cause: results[failedIdx[0]].reason })
  }
  if (failedIdx.length)
    logPartial(`players/${id} karera (${failedIdx.length}/${results.length} mavsum)`, results[failedIdx[0]].reason)
  const rows = results
    .filter(r => r.status === 'fulfilled')
    .map(r => careerRow(r.value))
    .filter(r => r.mp !== 0) // aniq 0 o'yin — tashlanadi; noma'lum (null) — ko'rsatiladi
    .sort((a, b) => String(b.year).localeCompare(String(a.year)))
  return {
    isGK: p.position === 'G',
    rows,
    partial: failedIdx.length > 0,
    failedSeasons: failedIdx.map(i => ({
      tid: tasks[i].tid,
      sid: tasks[i].sid,
      tournament: tasks[i].tName,
      year: tasks[i].year,
    })),
    truncated: all.length > tasks.length,
  }
}

// ---- O'yinchining tanlangan ligadagi mavsumi (statistika + heatmap + reyting tasmasi) ----
async function seasonEventsByDay(id, part) {
  const pages = await Promise.allSettled(SEASON_EVENT_PAGES.map(page => j(`/players/${id}/events/last`, { page })))
  const byDay = new Map()
  for (const res of pages) {
    const data = part.take(res, 'timeline', null)
    for (const ev of arr(data?.events).filter(isUsableEvent)) byDay.set(dayKey(ev.startTimestamp), ev)
  }
  return byDay
}

function timelineEntry(ev, rating, p) {
  if (!ev) return { date: null, oppName: null, rating }
  const side = playerSide(ev, p.team?.id, p.country?.name)
  const opp = side === 'home' ? ev.awayTeam : ev.homeTeam
  return {
    date: dateStr(ev.startTimestamp),
    matchId: String(ev.id),
    oppName: opp?.shortName || opp?.name,
    oppId: opp?.id,
    oppColor: colorOf(opp),
    rating,
  }
}

/** Tanlangan mavsum statistikasi: 404 → nollar (o'ynamagan), boshqa xato → UpstreamError. */
async function seasonStatistics(id, tid, sid) {
  try {
    return (await j(`/players/${id}/statistics/${tid}/${sid}`)).statistics || {}
  } catch (err) {
    if (err instanceof NotFoundError) return NO_APPEARANCES // bu mavsumda o'ynamagan — aniq nollar
    throw err
  }
}

export async function playerSeason(id, tid, sid) {
  const p = await loadPlayer(id)
  const part = createPartial(`players/${id}/season/${sid}`)
  const [stats, hm, lyr, evByDay] = await Promise.all([
    seasonStatistics(id, tid, sid),
    part.settle(j(`/players/${id}/heatmap/${tid}/${sid}`), 'heatmap', null),
    part.settle(j(`/players/${id}/last-year-summary`), 'timeline', null),
    seasonEventsByDay(id, part),
  ])
  // reyting tasmasi: last-year-summary'dan shu turnir reytinglari + raqib (events'dan kun bo'yicha)
  const ratingByDay = ratingsByDay(lyr?.summary, tid)
  const timeline = [...ratingByDay.keys()]
    .sort((a, b) => a - b)
    .map(d => timelineEntry(evByDay.get(d), ratingByDay.get(d), p))

  return {
    summary: seasonTotals(stats, p.position === 'G'),
    heatmap: arr(hm?.points),
    timeline,
    meta: { unavailable: part.unavailable },
  }
}
