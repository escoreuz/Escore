// API-Football adapteri testlari (T-13). Real so'rov YO'Q — fetchImpl mock; kalit soxta.
// Fayl 400 qatordan katta: bitta egalikdagi test fayli, har describe — bitta modul/eksport.
import { afterEach, beforeEach, describe, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApisportsAdapter } from '../apisports.js'
import { cacheKey, createClient } from '../apisports/client.js'
import { createDiskCache } from '../apisports/disk-cache.js'
import { createImageFetcher } from '../apisports/image.js'
import { mapStatus } from '../apisports/mappers.js'
import { createRateWindow } from '../apisports/quota.js'
import { days } from '../sofa/dates.js'
import { BadRequestError, NotFoundError, UpstreamError } from '../errors.js'

const KEY = 'TEST-SECRET-KEY-0000' // soxta kalit; hech qayerda ko'rinmasligi tekshiriladi
const BASE = 'https://api.test'
const SERVER_DIR = fileURLToPath(new URL('..', import.meta.url))
const MIN = 60_000
const TODAY = days().today
const T_LIVE = Date.UTC(2026, 9, 21, 20, 30) / 1000 // Toshkent 22-okt 01:30

let calls
let routes
let logs
let clock
let tmp
const logger = { warn: (...a) => logs.push(a.join(' ')) }

/** API javobi: body.response = response; header bilan kunlik qoldiq. */
const reply =
  (response, { remaining = 90, status = 200, errors = [] } = {}) =>
  () =>
    new Response(JSON.stringify({ errors, response }), {
      status,
      headers: { 'content-type': 'application/json', 'x-ratelimit-requests-remaining': String(remaining) },
    })

async function fetchImpl(input, opts) {
  const url = new URL(String(input))
  calls.push({ url: url.href, opts })
  const h = routes[url.pathname + url.search] ?? routes[url.pathname]
  if (!h) throw new Error(`kutilmagan so'rov: ${url.pathname}${url.search}`)
  return h(opts, url)
}

function makeClient({ file = null, ...over } = {}) {
  const store = createDiskCache({ file, now: () => clock, logger })
  return createClient({ baseUrl: BASE, key: KEY, store, fetchImpl, logger, now: () => clock, ...over })
}
const makeAdapter = (over = {}) => createApisportsAdapter({ client: makeClient(over), fetchImage: async () => null })

const fx = (id, { short = 'NS', ts = T_LIVE, league = 39, season = 2026, home = 10, away = 20, goals = {} } = {}) => ({
  fixture: { id, timestamp: ts, referee: 'R. Hakam', venue: { name: 'Stadion' }, status: { short, elapsed: 67 } },
  league: { id: league, name: `L${league}`, country: 'England', logo: 'l.png', season },
  teams: { home: { id: home, name: `T${home}` }, away: { id: away, name: `T${away}` } },
  goals: { home: goals.home ?? null, away: goals.away ?? null },
})
const isUp = e => e instanceof UpstreamError
const noKeyAnywhere = errs => {
  for (const text of [...logs, ...errs.map(e => e.message)]) assert.ok(!text.includes(KEY), 'kalit sizib chiqdi')
}

beforeEach(() => {
  calls = []
  routes = {}
  logs = []
  clock = Date.UTC(2026, 9, 22, 6, 0)
  tmp = mkdtempSync(join(tmpdir(), 'apisports-'))
})
afterEach(() => rmSync(tmp, { recursive: true, force: true }))

describe('status xaritasi va kalit tekshiruvi', () => {
  test('API-Football qisqa statuslari → eSCORE statuslari; noma’lum → null', () => {
    const table = { NS: 'sched', TBD: 'sched', '1H': 'live', HT: 'live', '2H': 'live', ET: 'live', BT: 'live' }
    Object.assign(table, { P: 'live', LIVE: 'live', FT: 'ft', AET: 'ft', PEN: 'ft', AWD: 'ft', WO: 'ft' })
    Object.assign(table, {
      PST: 'postponed',
      CANC: 'canceled',
      ABD: 'canceled',
      SUSP: 'interrupted',
      INT: 'interrupted',
    })
    for (const [code, want] of Object.entries(table)) assert.equal(mapStatus(code), want, code)
    assert.equal(mapStatus('XYZ'), null)
    assert.equal(mapStatus(undefined), null)
  })

  test('kalitsiz client yaratilmaydi; parametr oq ro’yxati → BadRequestError', () => {
    assert.throws(() => createClient({ baseUrl: BASE, key: '', store: createDiskCache() }), /APISPORTS_KEY/)
    assert.throws(() => createClient({ baseUrl: 'http://x', key: KEY, store: createDiskCache() }), /https/)
    assert.throws(() => cacheKey('/fixtures', { id: '1&x=2' }), BadRequestError)
    assert.equal(
      cacheKey('/fixtures', { timezone: 'Asia/Tashkent', date: TODAY }),
      `/fixtures?date=${TODAY}&timezone=Asia%2FTashkent`,
    )
  })

  test("index.js: DATA_PROVIDER=apisports + kalit yo'q → aniq xato bilan to'xtaydi", () => {
    const env = { ...process.env, DATA_PROVIDER: 'apisports', USE_REAL: '1', PORT: '4597' }
    delete env.APISPORTS_KEY
    const r = spawnSync(process.execPath, ['index.js'], { cwd: SERVER_DIR, env, encoding: 'utf8', timeout: 20_000 })
    assert.notEqual(r.status, 0)
    assert.match(r.stderr, /APISPORTS_KEY o'rnatilmagan/)
  })
})

describe('matchesForDate / matchesByDate', () => {
  test('xaritalash: Toshkent vaqti, live daqiqa, hisobsiz null, top ligalar oldin, yaroqsiz fixture tashlanadi', async () => {
    routes[`/fixtures`] = reply([
      fx(1, { league: 999 }),
      fx(2, { short: '2H', league: 39, goals: { home: 1, away: 0 } }),
      { fixture: { id: 3 } },
    ])
    const warn = mock.method(console, 'warn', () => {})
    const a = makeAdapter()
    const { matches, partial } = await a.matchesForDate(TODAY)
    assert.equal(partial, false)
    assert.deepEqual(
      matches.map(m => m.id),
      ['2', '1'],
    )
    const [live, sched] = matches
    assert.deepEqual([live.status, live.minute, live.hs, live.time, live.date], ['live', 67, 1, '01:30', '2026-10-22'])
    assert.deepEqual(live.home, { n: 'T10', c: null, id: 10 })
    assert.deepEqual(live.league, { id: '39', name: 'L39', country: 'England', flag: null, logo: 'l.png' })
    assert.deepEqual([sched.status, sched.minute, sched.hs], ['sched', null, null])
    assert.ok(warn.mock.calls.some(c => /id\/vaqtsiz/.test(c.arguments[0])))
    warn.mock.restore()
    assert.match(calls[0].url, /timezone=Asia%2FTashkent/)
    assert.deepEqual(
      (await a.matchesByDate(TODAY)).map(m => m.id),
      ['2', '1'],
    )
  })

  test("TTL: bugun (jonli bor) 3 daq; o'tgan sana 24 soat; kelajak 1 soat", async () => {
    routes['/fixtures'] = reply([fx(2, { short: '1H' })])
    const a = makeAdapter()
    await a.matchesForDate(TODAY)
    clock += 2 * MIN
    await a.matchesForDate(TODAY)
    assert.equal(calls.length, 1, 'TTL ichida fetch qilinmaydi (15 s polling)')
    clock += 2 * MIN
    await a.matchesForDate(TODAY)
    assert.equal(calls.length, 2)
    await a.matchesForDate('2020-01-01')
    await a.matchesForDate('2099-01-01')
    clock += 2 * 60 * MIN
    await a.matchesForDate('2020-01-01')
    await a.matchesForDate('2099-01-01')
    assert.equal(calls.length, 5) // o'tgan sana keshda, kelajak 1 soatdan keyin qayta
  })

  test('in-flight dedupe — parallel chaqiruvlar bitta fetch', async () => {
    routes['/fixtures'] = reply([fx(1)])
    const a = makeAdapter()
    await Promise.all([a.matchesForDate(TODAY), a.matchesForDate(TODAY), a.matchesByDate(TODAY)])
    assert.equal(calls.length, 1)
  })

  test('disk kesh: qayta ishga tushgandan keyin kvota sarflanmaydi (atomik fayl)', async () => {
    const file = join(tmp, 'cache.json')
    routes['/fixtures'] = reply([fx(1)])
    const c1 = makeClient({ file })
    await createApisportsAdapter({ client: c1 }).matchesForDate('2020-01-01')
    c1.flush()
    const a2 = createApisportsAdapter({ client: makeClient({ file }) })
    const { matches } = await a2.matchesForDate('2020-01-01')
    assert.equal(matches.length, 1)
    assert.equal(calls.length, 1)
  })

  test("buzilgan kesh fayli — log, bo'sh kesh, server yiqilmaydi", async () => {
    const file = join(tmp, 'cache.json')
    writeFileSync(file, '{buzuq')
    routes['/fixtures'] = reply([])
    assert.deepEqual((await makeAdapter({ file }).matchesForDate(TODAY)).matches, [])
    assert.ok(logs.some(l => /buzilgan/.test(l)))
  })
})

describe('kvota: kunlik byudjet, 429, errors maydoni, daqiqalik limiter', () => {
  test("qolgan ≤ 10: yangi so'rov yuborilmaydi (UpstreamError), keshdagi eskirgan javob stale=true", async () => {
    routes['/fixtures'] = reply([fx(7, { short: 'FT' })], { remaining: 10 })
    const a = makeAdapter()
    await a.matchesForDate('2020-01-01')
    await assert.rejects(a.matchesForDate('2020-01-02'), isUp)
    assert.equal(calls.length, 1)
    clock += 24 * 60 * MIN // yangi UTC kun — byudjet noma'lum, so'rov yana ruxsat
    await a.matchesForDate('2020-01-02')
    assert.equal(calls.length, 2)
  })

  test('byudjet tugagan, kesh eskirgan → stale javob (meta.stale) va partial', async () => {
    const a = makeAdapter()
    routes['/fixtures'] = reply([fx(8, { short: 'NS' })], { remaining: 50 })
    await a.matchDetail(8)
    await a.matchesForDate(TODAY)
    routes['/fixtures'] = reply([], { remaining: 3 })
    await a.matchesForDate('2020-01-05') // byudjet 3 ga tushadi
    clock += 30 * MIN
    const d = await a.matchDetail(8)
    assert.equal(d.meta.stale, true)
    const m = await a.matchesForDate(TODAY)
    assert.deepEqual([m.stale, m.partial], [true, true])
    assert.equal(calls.length, 3)
  })

  test("429 → UpstreamError va byudjet 0 (keyingi so'rov yuborilmaydi)", async () => {
    routes['/fixtures'] = reply([], { status: 429 })
    const a = makeAdapter()
    const e1 = await a.matchesForDate(TODAY).catch(e => e)
    assert.ok(isUp(e1))
    const e2 = await a.matchesForDate('2020-01-01').catch(e => e)
    assert.ok(isUp(e2) && /kvotasi tugagan/.test(e2.message))
    assert.equal(calls.length, 1)
    noKeyAnywhere([e1, e2])
  })

  test("API errors maydoni (token/plan) → UpstreamError, logda xabar bor, kalit yo'q", async () => {
    routes['/fixtures'] = reply([], { errors: { token: `Error/Missing application key ${KEY}` } })
    const err = await makeAdapter()
      .matchesForDate(TODAY)
      .catch(e => e)
    assert.ok(isUp(err))
    assert.ok(logs.some(l => /Missing application key/.test(l)))
    noKeyAnywhere([err])
    assert.equal(calls[0].opts.headers['x-apisports-key'], KEY)
    assert.ok(!calls[0].url.includes(KEY), 'kalit URL da emas')
  })

  test('doimiy API xatosi (plan) 6 soat negativ keshlanadi — kvota qayta sarflanmaydi', async () => {
    routes['/standings'] = reply([], { errors: { plan: 'Free plans do not have access to this season' } })
    const a = makeAdapter()
    routes['/leagues?id=39'] = reply([{ league: { id: 39, name: 'PL' }, seasons: [{ year: 2026, current: true }] }])
    routes['/fixtures'] = reply([], { errors: { plan: 'Free plans do not have access to this season' } })
    routes['/players/topscorers'] = reply([], { errors: { plan: 'x' } })
    const l1 = await a.league(39)
    const l2 = await a.league(39)
    assert.deepEqual(l1.meta.unavailable, ['standings', 'matches/last', 'matches/next', 'scorers'])
    assert.deepEqual(l2.meta.unavailable, l1.meta.unavailable)
    assert.equal(calls.length, 5) // 1 /leagues + 4 bo'lim; ikkinchi chaqiruv — 0 ta real so'rov
    clock += 6 * 60 * MIN + 1
    await a.league(39)
    assert.equal(calls.length, 9) // 6 soatdan keyin qayta urinadi
  })

  test('errors.requests (kunlik limit) → byudjet tugaydi', async () => {
    routes['/fixtures'] = reply([], { errors: { requests: 'You have reached the request limit for the day' } })
    const a = makeAdapter()
    await assert.rejects(a.matchesForDate(TODAY), isUp)
    await assert.rejects(a.matchesForDate('2020-01-01'), e => /kvotasi tugagan/.test(e.message))
    assert.equal(calls.length, 1)
  })

  test('timeout → 504; 500 → 502; 404 → NotFound; response massiv emas / JSON emas → UpstreamError', async () => {
    const a = makeAdapter()
    routes['/fixtures?id=1'] = () => Promise.reject(new DOMException('t', 'TimeoutError'))
    routes['/fixtures?id=2'] = reply([], { status: 500 })
    routes['/fixtures?id=3'] = reply([], { status: 404 })
    routes['/fixtures?id=4'] = reply({ not: 'array' })
    routes['/fixtures?id=5'] = () => new Response('<html>', { status: 200 })
    routes['/fixtures?id=6'] = () => Promise.reject(new Error(`network ${KEY}`))
    const errs = []
    for (const [id, check] of [
      [1, e => isUp(e) && e.status === 504],
      [2, e => isUp(e) && e.status === 502],
      [3, e => e instanceof NotFoundError],
      [4, isUp],
      [5, isUp],
      [6, isUp],
    ]) {
      const e = await a.matchDetail(id).catch(x => x)
      assert.ok(check(e), `id=${id}: ${e?.message}`)
      errs.push(e)
    }
    noKeyAnywhere(errs)
  })

  test("daqiqalik limiter: limitdan oshgani kutadi; navbat to'lsa yoki kutish oshsa 503", async () => {
    const acquire = createRateWindow({ limit: 2, windowMs: 40, maxQueue: 1, maxWaitMs: 1000 })
    const t0 = Date.now()
    await acquire()
    await acquire()
    const third = acquire()
    await assert.rejects(acquire(), e => isUp(e) && e.status === 503) // navbat to'la
    await third
    assert.ok(Date.now() - t0 >= 35, 'uchinchi so’rov oyna tugashini kutdi')
    const slow = createRateWindow({ limit: 1, windowMs: 10_000, maxQueue: 5, maxWaitMs: 20 })
    await slow()
    await assert.rejects(slow(), e => isUp(e) && /kutish/.test(e.message))
  })

  test("client daqiqalik limiti (perMinute=2): 3-so'rov oyna tugaguncha kutadi", async () => {
    routes['/fixtures'] = reply([])
    const a = createApisportsAdapter({ client: makeClient({ perMinute: 2, windowMs: 40, now: Date.now }) })
    const t0 = Date.now()
    await Promise.all(['2020-01-01', '2020-01-02', '2020-01-03'].map(d => a.matchesForDate(d)))
    assert.equal(calls.length, 3)
    assert.ok(Date.now() - t0 >= 35)
  })
})

describe('matchDetail / scorers / standingsMini / home', () => {
  const detail = () => ({
    ...fx(50, { short: 'FT', goals: { home: 2, away: 1 } }),
    events: [
      { time: { elapsed: 30 }, team: { id: 20 }, player: { name: 'B' }, type: 'Card', detail: 'Yellow Card' },
      {
        time: { elapsed: 10 },
        team: { id: 10 },
        player: { name: 'A' },
        assist: { name: 'C' },
        type: 'Goal',
        detail: 'Normal Goal',
      },
      { time: { elapsed: 50 }, team: { id: 10 }, player: { name: 'A' }, type: 'Goal', detail: 'Missed Penalty' },
      { time: { elapsed: 80 }, team: { id: 20 }, player: { name: 'D' }, type: 'Card', detail: 'Red Card' },
    ],
    statistics: [
      {
        team: { id: 10 },
        statistics: [
          { type: 'Shots on Goal', value: 5 },
          { type: 'Ball Possession', value: '60%' },
        ],
      },
      { team: { id: 20 }, statistics: [{ type: 'Shots on Goal', value: 2 }] },
    ],
    lineups: [
      { team: { id: 10 }, formation: '4-3-3', startXI: [{ player: { id: 1, name: 'GK', number: 1, pos: 'G' } }] },
    ],
  })

  test('odatiy: events/stats/lineups bitta javobdan; vote null; momentum unavailable; refereeId null', async () => {
    routes['/fixtures?id=50'] = reply([detail()])
    const d = await makeAdapter().matchDetail(50)
    assert.deepEqual(
      d.events.map(e => [e.min, e.type, e.team]),
      [
        [10, 'goal', 'home'],
        [30, 'yellow', 'away'],
        [80, 'red', 'away'],
      ],
    )
    assert.deepEqual(d.stats[1], { label: 'Ball Possession', home: '60%', away: null, bar: true })
    assert.deepEqual(d.lineups.home, {
      formation: '4-3-3',
      lines: [4, 3, 3],
      players: [{ id: 1, n: 1, name: 'GK', pos: 'DG' }],
    })
    assert.deepEqual(d.lineups.away, { formation: '', lines: [], players: [] })
    assert.deepEqual([d.vote, d.referee, d.refereeId, d.venue, d.played], [null, 'R. Hakam', null, 'Stadion', true])
    assert.deepEqual(d.meta, { unavailable: ['momentum'] })
  })

  test("bo'sh javob → NotFoundError", async () => {
    routes['/fixtures?id=51'] = reply([])
    await assert.rejects(makeAdapter().matchDetail(51), NotFoundError)
  })

  test('scorers/standingsMini: top liga ustuvor; o’yin yo’q → []; topscorers xato → Upstream', async () => {
    routes['/fixtures'] = reply([fx(1, { league: 500 }), fx(2, { league: 500 }), fx(3, { league: 140 })])
    routes['/players/topscorers'] = reply([
      {
        player: { id: 9, name: 'S' },
        statistics: [{ team: { id: 10, name: 'T' }, goals: { total: 7, assists: null } }],
      },
    ])
    const rows = Array.from({ length: 7 }, (_, i) => ({
      rank: i + 1,
      team: { id: i, name: `C${i}` },
      points: 20 - i,
      all: {},
    }))
    routes['/standings'] = reply([{ league: { standings: [rows] } }])
    const a = makeAdapter()
    assert.deepEqual(await a.scorers(TODAY), [
      { rank: 1, id: 9, teamId: 10, name: 'S', team: 'T', goals: 7, assists: null, c: null },
    ])
    assert.match(calls.find(c => c.url.includes('topscorers')).url, /league=140/)
    assert.deepEqual((await a.standingsMini(TODAY))[0], { pos: 1, club: 'C0', pts: 20 })
    routes['/fixtures'] = reply([])
    assert.deepEqual(await a.scorers('2020-01-01'), [])
    routes['/fixtures'] = reply([fx(4, { league: 61 })])
    routes['/players/topscorers'] = reply([], { status: 500 })
    await assert.rejects(a.scorers('2020-01-02'), isUp)
  })

  test("home: yangilik yo'q → source null; natija/fikstura; ikkala bo'lim yiqilsa Upstream", async () => {
    routes['/fixtures'] = reply([fx(1, { short: 'FT', goals: { home: 1, away: 1 } }), fx(2), fx(3, { short: 'CANC' })])
    routes['/standings'] = reply([], { status: 500 })
    const h = await makeAdapter().home()
    assert.deepEqual([h.lead, h.meta.source, h.meta.partial], [null, null, false])
    assert.deepEqual(h.meta.unavailable, ['standings'])
    assert.deepEqual(h.results, [{ home: 'T10', hs: 1, as: 1, away: 'T20' }])
    assert.equal(h.fixtures.length, 1)
    routes['/fixtures'] = reply([], { status: 500 })
    await assert.rejects(makeAdapter().home(), isUp)
  })
})

describe('league / team / coach', () => {
  const leagueRoutes = () => {
    routes['/leagues?id=39'] = reply([
      {
        league: { id: 39, name: 'Premier League', logo: 'p.png' },
        country: { name: 'England' },
        seasons: [{ year: 2025 }, { year: 2026, current: true }],
      },
    ])
    const row = {
      rank: 1,
      team: { id: 10, name: 'T10' },
      points: 9,
      goalsDiff: 4,
      form: 'WDL',
      group: 'Premier League',
    }
    Object.assign(row, {
      all: { played: 3, win: 2, draw: 1, lose: 0, goals: { for: 6, against: 2 } },
      home: { win: 1, draw: 0, lose: 0 },
    })
    routes['/standings'] = reply([{ league: { standings: [[row]] } }])
    routes['/fixtures'] = reply([fx(1, { short: 'FT' })])
    routes['/players/topscorers'] = reply([], { status: 500 })
  }

  test("league: joriy mavsum avtomatik, jadval qatori, 503 bo'lim → meta.unavailable", async () => {
    leagueRoutes()
    const l = await makeAdapter().league(39)
    assert.equal(l.currentSeasonId, 2026)
    assert.deepEqual(l.seasons[0], { id: 2026, year: '2026' })
    assert.deepEqual(l.league, { id: '39', name: 'Premier League', country: 'England', flag: null, logo: 'p.png' })
    const r = l.groups[0].rows[0]
    assert.deepEqual([r.P, r.Pts, r.GF, r.GA, r.GD, r.form], [3, 9, 6, 2, 4, ['G', 'D', 'M']])
    assert.deepEqual([r.home, r.away, r.c], [{ w: 1, d: 0, l: 0 }, null, null])
    assert.equal(l.matches.length, 2)
    assert.deepEqual(l.meta.unavailable, ['scorers'])
    assert.ok(calls.some(c => /season=2026/.test(c.url) && /last=10/.test(c.url)))
  })

  test("league: bo'sh /leagues → NotFound; xato → Upstream", async () => {
    routes['/leagues?id=1'] = reply([])
    routes['/leagues?id=2'] = reply([], { status: 500 })
    await assert.rejects(makeAdapter().league(1), NotFoundError)
    await assert.rejects(makeAdapter().league(2), isUp)
  })

  test("team: sostav, forma, murabbiy, liga; 503 sostav → unavailable; bo'sh → NotFound", async () => {
    routes['/teams?id=10'] = reply([
      { team: { id: 10, name: 'T10', country: 'England', founded: 1900 }, venue: { name: 'S', city: 'C' } },
    ])
    routes['/players/squads?team=10'] = reply([], { status: 503 })
    routes['/fixtures?last=5&team=10'] = reply([
      fx(2, { short: 'FT', ts: T_LIVE + 100, goals: { home: 0, away: 1 } }),
      fx(1, { short: 'FT', goals: { home: 2, away: 0 } }),
    ])
    routes['/fixtures?next=5&team=10'] = reply([fx(3, { league: 2, ts: T_LIVE + 200 })])
    routes['/coachs?team=10'] = reply([{ id: 77, name: 'Coach', career: [{ team: { id: 10 }, end: null }] }])
    routes['/teams?id=11'] = reply([])
    const a = makeAdapter()
    const t = await a.team(10)
    assert.deepEqual(t.form, ['G', 'M'])
    assert.deepEqual(
      [t.info.coach, t.info.coachId, t.info.founded, t.leagueId, t.color],
      ['Coach', 77, 1900, '39', null],
    )
    assert.deepEqual(t.squad, [])
    assert.deepEqual(t.meta.unavailable, ['squad'])
    assert.deepEqual(
      t.matches.map(m => m.id),
      ['3', '2', '1'],
    )
    await assert.rejects(a.team(11), NotFoundError)
  })

  test("coach: karyera; o'yinlar jamoa fixtures'dan; bo'sh → NotFound", async () => {
    routes['/coachs?id=77'] = reply([
      {
        id: 77,
        name: 'Coach',
        age: 50,
        nationality: 'Spain',
        team: { id: 10, name: 'T10' },
        career: [{ team: { id: 10, name: 'T10' }, start: '2020-07-01', end: null }],
      },
    ])
    routes['/fixtures?last=5&team=10'] = reply([fx(1, { short: 'FT' })])
    routes['/coachs?id=78'] = reply([])
    const a = makeAdapter()
    const c = await a.coach(77)
    assert.deepEqual(c.career[0], {
      club: 'T10',
      id: 10,
      c: null,
      from: '2020-07-01',
      to: null,
      games: null,
      ppg: null,
      trophies: null,
    })
    assert.deepEqual([c.country, c.age, c.totalTrophies, c.matches.length], ['Spain', 50, null, 1])
    await assert.rejects(a.coach(78), NotFoundError)
  })
})

describe('player / playerSeason / playerCareer', () => {
  const stat = { team: { id: 10, name: 'T10' }, league: { id: 39, name: 'PL', season: 2026 } }
  Object.assign(stat, {
    games: { appearences: 8, lineups: 7, minutes: 640, number: 9, position: 'Attacker', rating: '7.25' },
  })
  Object.assign(stat, { goals: { total: 5, assists: null }, passes: { total: 100, accuracy: '81' } })

  test("player: statistika, mavjud bo'lmagan imkoniyatlar → [] / null + meta.unavailable", async () => {
    routes['/players/seasons?player=5'] = reply([2024, 2026, 2025])
    routes['/players?id=5&season=2026'] = reply([
      { player: { id: 5, name: 'P', age: 25, nationality: 'Uzbekistan', height: '180 cm' }, statistics: [stat] },
    ])
    const p = await makeAdapter().player(5)
    assert.deepEqual(
      [p.team, p.rating, p.posLabel, p.value, p.base.number, p.base.height],
      ['T10', '7.25', 'Hujumchi', null, 9, '180 cm'],
    )
    assert.deepEqual([p.seasonSummary.goals, p.seasonSummary.assists, p.seasonSummary.minutesPerGame], [5, null, 80])
    assert.deepEqual([p.attrs, p.strengths, p.recent, p.monthly], [[], [], [], []])
    assert.deepEqual(p.meta.unavailable, ['attrs', 'heatmap', 'monthly', 'recent'])
    assert.deepEqual(p.seasonsList, [{ tid: 39, sid: 2026, name: 'PL', year: '2026' }])
  })

  test("o'yinchi topilmasa NotFound; playerSeason: liga statistikasi yo'q → nollar; karyera jamoa×mavsum", async () => {
    routes['/players/seasons?player=6'] = reply([])
    routes['/players?id=5&season=2025'] = reply([{ player: { id: 5, name: 'P' }, statistics: [stat] }])
    routes['/players/seasons?player=5'] = reply([2025])
    routes['/players/teams?player=5'] = reply([{ team: { id: 10, name: 'T10' }, seasons: [2025, 2024] }])
    const a = makeAdapter()
    await assert.rejects(a.player(6), NotFoundError)
    const s = await a.playerSeason(5, 140, 2025)
    assert.deepEqual([s.summary.appearances, s.summary.goals], [0, 0])
    assert.deepEqual(s.meta.unavailable, ['heatmap', 'timeline'])
    const c = await a.playerCareer(5)
    assert.deepEqual(
      c.rows.map(r => [r.year, r.tournament, r.mp]),
      [
        ['2025', 'T10', null],
        ['2024', 'T10', null],
      ],
    )
    assert.deepEqual([c.isGK, c.partial, c.truncated], [false, false, false])
  })
})

describe("countries / API'da yo'q imkoniyatlar / fetchImage", () => {
  test('countries: nom bo’yicha tartib raqami id; countryLeagues nom orqali; noma’lum id → NotFound', async () => {
    routes['/countries'] = reply([{ name: 'Spain', code: 'ES' }, { name: 'England', code: 'GB' }, { code: 'X' }])
    routes['/leagues?country=Spain'] = reply([{ league: { id: 140, name: 'La Liga' } }, {}])
    const a = makeAdapter()
    assert.deepEqual(await a.countries(), [
      { id: 1, name: 'England' },
      { id: 2, name: 'Spain' },
    ])
    assert.deepEqual(await a.countryLeagues(2), [{ id: 140, name: 'La Liga' }])
    await assert.rejects(a.countryLeagues(9), NotFoundError)
    assert.equal(calls.length, 2) // /countries keshdan qayta ishlatildi
  })

  test('referee / rankings / article → NotFound; news → []', async () => {
    const a = makeAdapter()
    await assert.rejects(a.referee(1), NotFoundError)
    await assert.rejects(a.rankings('fifa'), NotFoundError)
    await assert.rejects(a.article('x'), NotFoundError)
    assert.deepEqual(await a.news(), [])
    assert.equal(calls.length, 0)
  })

  test('fetchImage: media URL, kalit yuborilmaydi; text/html → Upstream; 404 negativ kesh; hakam → NotFound', async () => {
    const seen = []
    const img = createImageFetcher({
      fetchImpl: async (url, opts) => {
        seen.push({ url, opts })
        if (url.endsWith('/teams/1.png'))
          return new Response(new Uint8Array([1, 2]), { headers: { 'content-type': 'image/png' } })
        if (url.endsWith('/leagues/2.png')) return new Response('<html>', { headers: { 'content-type': 'text/html' } })
        return new Response('', { status: 404 })
      },
    })
    const a = await img('team', 1)
    assert.deepEqual([a.type, [...a.buf]], ['image/png', [1, 2]])
    assert.equal(await img('team', 1), a)
    assert.equal(seen[0].url, 'https://media.api-sports.io/football/teams/1.png')
    assert.equal(seen[0].opts.headers, undefined)
    await assert.rejects(img('tournament', 2), isUp)
    await assert.rejects(img('manager', 3), NotFoundError)
    await assert.rejects(img('manager', 3), NotFoundError)
    await assert.rejects(img('referee', 4), NotFoundError)
    await assert.rejects(img('player', '../x'), BadRequestError)
    assert.equal(seen.length, 3)
  })
})
