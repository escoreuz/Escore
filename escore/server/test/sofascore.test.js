// SofaScore adapteri testlari (T-03). Real upstream'ga so'rov YO'Q — global fetch mock.
// Fayl 400 qatordan katta: egalik bitta test fayliga berilgan (FIX-PLAN §4), har describe — bitta modul.
import { after, afterEach, beforeEach, describe, mock, test } from 'node:test'
import assert from 'node:assert/strict'

// Modul yuklanishidan oldin: soxta host va qisqa timeout (real timeout simini tekshirish uchun)
process.env.SCORE_API = 'http://score.test'
process.env.SOFA_TIMEOUT_MS = '50'

const sofa = await import('../sofascore.js')
const { j, request, clearCache } = await import('../sofa/http.js')
const { clearImageCache } = await import('../sofa/image.js')
const { createTtlCache } = await import('../sofa/cache.js')
const { createLimiter } = await import('../sofa/limiter.js')
const { mapStatus } = await import('../sofa/format.js')
const { BadRequestError, NotFoundError, UpstreamError } = await import('../errors.js')

const realFetch = globalThis.fetch
let calls = []
let unexpected = []

const json = (body, code = 200) =>
  new Response(JSON.stringify(body), { status: code, headers: { 'content-type': 'application/json' } })
const status = code => () => json({ detail: 'x' }, code)
const gt = (_o, url) => json([[[`UZ:${url.searchParams.get('q')}`]]]) // Google Translate javobi
const deferred = () => {
  let resolve
  const promise = new Promise(r => (resolve = r))
  return { promise, resolve }
}
const paths = () => calls.map(c => new URL(c.url).pathname)
const isUpstream = code => e => e instanceof UpstreamError && (code === undefined || e.status === code)

/** Marshrut jadvali: '/path?query' yoki '/path' → body | (opts, url) => Response. 'google' — tarjima. */
function routes(table) {
  globalThis.fetch = async (input, opts) => {
    const url = new URL(String(input))
    calls.push({ url: url.href, opts })
    const key = url.hostname === 'score.test' ? url.pathname + url.search : 'google'
    const h = table[key] ?? table[url.pathname]
    if (h === undefined) {
      unexpected.push(url.href)
      return json({ detail: 'unexpected' }, 599)
    }
    return typeof h === 'function' ? h(opts, url) : json(h)
  }
}

// Node 22 test runner faqat unref qilingan taymerlar (AbortSignal.timeout) qolganda jarayonni
// tirik ushlamaydi — har test davomida ref'li bo'sh interval event loop'ni ushlab turadi.
const KEEPALIVE_MS = 1000
let keepAlive = null
let warn
beforeEach(() => {
  keepAlive = setInterval(() => {}, KEEPALIVE_MS)
  clearCache()
  clearImageCache()
  calls = []
  unexpected = []
  warn = mock.method(console, 'warn', () => {})
})
afterEach(() => {
  clearInterval(keepAlive)
  warn.mock.restore()
  mock.timers.reset()
  assert.deepEqual(unexpected, [], "kutilmagan upstream so'rovlari")
})
after(() => {
  globalThis.fetch = realFetch
})

// ---- vaqt nuqtalari (Toshkent = UTC+5) ----
const D = '2026-10-16'
const PREV = '2026-10-15'
const T16_0130 = Date.UTC(2026, 9, 15, 20, 30) / 1000 // UTC 15-kun → Toshkent 16-kun 01:30
const T16_1300 = Date.UTC(2026, 9, 16, 8, 0) / 1000 // Toshkent 16-kun 13:00
const T17_0100 = Date.UTC(2026, 9, 16, 20, 0) / 1000 // UTC 16-kun → Toshkent 17-kun
const T15_1500 = Date.UTC(2026, 9, 15, 10, 0) / 1000 // Toshkent 15-kun
const ev = (id, ts, extra = {}) => ({
  id,
  startTimestamp: ts,
  status: { type: 'notstarted' },
  homeTeam: { id: 1, name: 'A' },
  awayTeam: { id: 2, name: 'B' },
  tournament: { uniqueTournament: { id: 17, name: 'PL', userCount: 10 } },
  season: { id: 77 },
  ...extra,
})
const sched = (prev, cur) => ({ [`/events/date/${PREV}`]: prev, [`/events/date/${D}`]: cur })
const atTashkent16 = () => mock.timers.enable({ apis: ['Date'], now: T16_0130 * 1000 })

describe('http qatlami: xato klassifikatsiyasi', () => {
  test('timeout (TimeoutError) → UpstreamError 504, signal uzatiladi', async () => {
    routes({
      '/teams/1': opts => {
        assert.ok(opts.signal instanceof AbortSignal)
        throw new DOMException('timed out', 'TimeoutError')
      },
    })
    await assert.rejects(j('/teams/1'), isUpstream(504))
  })

  test('real AbortSignal.timeout ishlaydi (SOFA_TIMEOUT_MS=50) → 504', async () => {
    routes({
      '/teams/2': opts =>
        new Promise((_, reject) => opts.signal.addEventListener('abort', () => reject(opts.signal.reason))),
    })
    await assert.rejects(j('/teams/2'), isUpstream(504))
  })

  test('403 (anti-bot challenge) → UpstreamError, NotFound emas', async () => {
    routes({ '/events/live': status(403) })
    await assert.rejects(j('/events/live'), e => isUpstream()(e) && /403/.test(e.message))
  })

  test('404 → NotFound; tarmoq → 502; JSON emas / massiv / null → UpstreamError (yaroqsiz javob)', async () => {
    routes({
      '/teams/404': status(404),
      '/teams/net': () => Promise.reject(new TypeError('fetch failed')),
      '/teams/bad': () => new Response('<html>', { status: 200 }),
      '/teams/arr': [1, 2],
      '/teams/nul': () => json(null),
    })
    await assert.rejects(j('/teams/404'), NotFoundError)
    await assert.rejects(j('/teams/net'), isUpstream(502))
    for (const p of ['/teams/bad', '/teams/arr', '/teams/nul']) {
      await assert.rejects(j(p), e => isUpstream(502)(e) && /yaroqsiz javob/.test(e.message), p)
    }
  })
})

describe('http qatlami: kesh, dedupe, limiter', () => {
  test('kesh hit — fetch bir marta', async () => {
    routes({ '/teams/5': { team: { id: 5 } } })
    assert.deepEqual(await j('/teams/5'), { team: { id: 5 } })
    assert.deepEqual(await j('/teams/5'), { team: { id: 5 } })
    assert.equal(calls.length, 1)
  })

  test('in-flight dedupe — parallel ikki chaqiruv, bitta fetch', async () => {
    const gate = deferred()
    routes({ '/teams/6': () => gate.promise.then(() => json({ ok: 6 })) })
    const both = Promise.all([j('/teams/6'), j('/teams/6')])
    gate.resolve()
    assert.deepEqual(await both, [{ ok: 6 }, { ok: 6 }])
    assert.equal(calls.length, 1)
  })

  test("xato keshlanmaydi — 500 dan keyin qayta so'raladi", async () => {
    let n = 0
    routes({ '/teams/7': () => (++n === 1 ? json({}, 500) : json({ ok: 7 })) })
    await assert.rejects(j('/teams/7'), UpstreamError)
    assert.deepEqual(await j('/teams/7'), { ok: 7 })
    assert.equal(calls.length, 2)
  })

  test("404 negativ kesh 60 s, keyin qayta so'raladi; TTL: /events 15 s, /teams 10 daqiqa", async () => {
    mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 9, 15, 12) })
    routes({ '/teams/8': status(404), '/events/live': { events: [] }, '/teams/9': { team: {} } })
    await assert.rejects(j('/teams/8'), NotFoundError)
    await assert.rejects(j('/teams/8'), NotFoundError)
    await j('/events/live')
    await j('/teams/9')
    mock.timers.tick(16_000)
    await j('/events/live')
    await j('/teams/9')
    mock.timers.tick(61_000)
    await assert.rejects(j('/teams/8'), NotFoundError)
    assert.deepEqual(paths(), ['/teams/8', '/events/live', '/teams/9', '/events/live', '/teams/8'])
  })

  test("createTtlCache: kalit soni va umumiy og'irlik chegarasi (eskisi o'chadi)", () => {
    const c = createTtlCache({ maxEntries: 2, maxWeight: 10 })
    c.set('a', 1, 1000)
    c.set('b', 2, 1000)
    c.get('a') // a — yangi ishlatilgan
    c.set('c', 3, 1000)
    assert.equal(c.get('b'), undefined)
    assert.equal(c.get('a'), 1)
    c.set('big', 4, 1000, 9)
    c.set('big2', 6, 1000, 5) // 14 > 10 — eskisi chiqariladi
    assert.equal(c.get('big'), undefined)
    assert.equal(c.get('big2'), 6)
    c.set('huge', 5, 1000, 11) // chegaradan katta — keshlanmaydi
    assert.equal(c.get('huge'), undefined)
  })

  test("limiter: navbat to'lsa 503; navbatda kutish oshsa 503; reject'dan keyin slot bo'shaydi", async () => {
    const run = createLimiter({ concurrency: 1, maxQueue: 1, maxWaitMs: 20 })
    const gate = deferred()
    const first = run(() => gate.promise)
    const waiting = run(async () => 'late')
    await assert.rejects(
      run(async () => 'x'),
      isUpstream(503),
    ) // navbat to'la
    await assert.rejects(waiting, e => isUpstream(503)(e) && /kutish/.test(e.message))
    gate.resolve('done')
    assert.equal(await first, 'done')
    await assert.rejects(
      run(() => Promise.reject(new Error('boom'))),
      /boom/,
    )
    assert.equal(await run(async () => 'ok'), 'ok') // slot bo'shagan
  })
})

describe('path xavfsizligi', () => {
  test('traversal, kodlangan slash, ? va # → BadRequestError (400); fetch chaqirilmaydi', async () => {
    routes({})
    const bad400 = e => e instanceof BadRequestError && e.status === 400
    for (const p of ['/teams/../admin', '/news/a%2Fb', '/teams/1?x=1', '/teams/1#a', 'teams/1', '/teams//1']) {
      await assert.rejects(j(p), bad400, p)
    }
    await assert.rejects(
      request('/teams/../x', r => r.json()),
      bad400,
    )
    await assert.rejects(sofa.team('1/../../x'), bad400)
    await assert.rejects(sofa.article('../secret'), bad400)
    await assert.rejects(sofa.fetchImage('team', '..'), bad400)
    await assert.rejects(sofa.rankings('../x'), bad400)
    assert.equal(calls.length, 0)
  })
})

describe("o'yinlar (eventsForDate / matchesForDate)", () => {
  test("scheduled: UTC D-1 va D birlashadi, Toshkent sanasi bo'yicha filtr, takror yo'q", async () => {
    routes(
      sched(
        { events: [ev(1, T16_0130), ev(2, T15_1500)] },
        { events: [ev(1, T16_0130), ev(3, T16_1300), ev(4, T17_0100)] },
      ),
    )
    const { matches, partial } = await sofa.matchesForDate(D)
    assert.equal(partial, false)
    assert.deepEqual(
      matches.map(m => [m.id, m.time, m.date]),
      [
        ['1', '01:30', D],
        ['3', '13:00', D],
      ],
    )
    assert.deepEqual(
      (await sofa.matchesByDate(D)).map(m => m.id),
      ['1', '3'],
    )
  })

  test("403/5xx → UpstreamError, live zaxirasiga O'TILMAYDI", async () => {
    routes(sched({ events: [] }, status(403)))
    await assert.rejects(sofa.matchesByDate(D), isUpstream())
    assert.ok(!paths().includes('/events/live'))
  })

  test('scheduled butunlay 404 → live zaxirasi, partial=true', async () => {
    routes({ ...sched(status(404), status(404)), '/events/live': { events: [ev(1, T16_0130), ev(2, T15_1500)] } })
    const { matches, partial } = await sofa.matchesForDate(D)
    assert.equal(partial, true)
    assert.deepEqual(
      matches.map(m => m.id),
      ['1'],
    )
  })

  test('scheduled 404 + live yiqilsa → UpstreamError; bitta kun 404 → partial', async () => {
    routes({ ...sched(status(404), status(404)), '/events/live': status(500) })
    await assert.rejects(sofa.matchesForDate(D), isUpstream())
    clearCache()
    routes(sched(status(404), { events: [ev(3, T16_1300)] }))
    assert.equal((await sofa.matchesForDate(D)).partial, true)
  })

  test("startTimestamp yoki id yo'q event log bilan tashlanadi, ro'yxat yiqilmaydi", async () => {
    routes(
      sched(
        { events: [] },
        { events: [ev(3, T16_1300), ev(5, undefined), ev(6, 'x'), ev(undefined, T16_1300), ev(null, T16_1300)] },
      ),
    )
    const list = await sofa.matchesByDate(D)
    assert.deepEqual(
      list.map(m => m.id),
      ['3'],
    )
    assert.ok(warn.mock.calls.some(c => /4 ta event vaqtsiz yoki id'siz/.test(c.arguments[0])))
  })

  test('mapStatus: canceled/postponed alohida; mapMatch placeholder emas, null', () => {
    assert.equal(mapStatus('canceled'), 'canceled')
    assert.equal(mapStatus('postponed'), 'postponed')
    assert.equal(mapStatus('suspended'), 'interrupted')
    assert.equal(mapStatus('notstarted'), 'sched')
    // statussiz / noma'lum tur — taxmin qilinmaydi
    assert.equal(mapStatus(undefined), null)
    assert.equal(mapStatus('weird-new-type'), null)
  })

  test('mapMatch: hisob yo`q → null, tugagan o`yin minute null, leagueId yo`q → null', async () => {
    routes(sched({ events: [] }, { events: [ev(3, T16_1300, { status: { type: 'finished' }, tournament: {} })] }))
    const [m] = await sofa.matchesByDate(D)
    assert.equal(m.hs, null)
    assert.equal(m.minute, null)
    assert.equal(m.leagueId, null)
    assert.equal(m.league.name, null)
    assert.equal(m.status, 'ft')
  })

  test("statussiz event: status null, jonli emas, fixtures'ga ham kirmaydi", async () => {
    routes(sched({ events: [] }, { events: [ev(3, T16_1300, { status: undefined, homeTeam: {} })] }))
    const [m] = await sofa.matchesByDate(D)
    assert.equal(m.status, null)
    assert.equal(m.minute, null)
    assert.equal(m.home.n, null)
    assert.equal(sofa.pickFeatured([m]), null)
  })

  test("scorers/standingsMini: o'yin yo'q → []; odatiy; top-players 503 → UpstreamError", async () => {
    routes(sched({ events: [] }, { events: [] }))
    assert.deepEqual(await sofa.scorers(D), [])
    assert.deepEqual(await sofa.standingsMini(D), [])
    clearCache()
    const top = { topPlayers: { goals: [{ player: { name: 'X' }, team: { name: 'T' }, statistics: { goals: 9 } }] } }
    const rows = Array.from({ length: 7 }, (_, i) => ({ position: i + 1, team: { name: `C${i}` }, points: 20 - i }))
    routes({
      ...sched({ events: [] }, { events: [ev(3, T16_1300)] }),
      '/tournaments/17/season/77/top-players/overall': top,
      '/tournaments/17/season/77/standings': { standings: [{ rows }] },
    })
    assert.deepEqual(await sofa.scorers(D), [
      { rank: 1, id: null, teamId: null, name: 'X', team: 'T', goals: 9, c: '#444' },
    ])
    assert.equal((await sofa.standingsMini(D)).length, 5)
    clearCache()
    routes({
      ...sched({ events: [] }, { events: [ev(3, T16_1300)] }),
      '/tournaments/17/season/77/top-players/overall': status(503),
    })
    await assert.rejects(sofa.scorers(D), isUpstream())
  })

  test("pickFeatured: birinchi jonli, yo'q bo'lsa null, massiv bo'lmasa TypeError", () => {
    const ms = [
      { id: 'a', status: 'ft' },
      { id: 'b', status: 'live' },
      { id: 'c', status: 'live' },
    ]
    assert.equal(sofa.pickFeatured(ms).id, 'b')
    assert.equal(sofa.pickFeatured([{ status: 'sched' }]), null)
    assert.throws(() => sofa.pickFeatured(null), TypeError)
  })
})

describe('days() — Asia/Tashkent', () => {
  test('UTC 20:30 → Toshkentda ertangi kun', () => {
    atTashkent16()
    const { today, days } = sofa.days()
    assert.equal(today, D)
    assert.deepEqual(
      days.map(d => d.date),
      ['2026-10-14', PREV, D, '2026-10-17', '2026-10-18'],
    )
    assert.deepEqual(days[2], { date: D, dow: 'JUM', d: '16', label: 'Bugun' })
  })

  test('yil chegarasi: 31-dekabr 19:30 UTC → 1-yanvar', () => {
    mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 11, 31, 19, 30) })
    const { today, days } = sofa.days()
    assert.equal(today, '2027-01-01')
    assert.equal(days[0].date, '2026-12-30')
  })
})

describe('matchDetail()', () => {
  const xgStats = {
    statistics: [
      {
        period: 'ALL',
        groups: [
          {
            statisticsItems: [
              { key: 'expectedGoals', name: 'Expected goals', home: 1.5, away: 0.5 },
              { key: 'cornerKicks', name: 'Corners', home: 3 },
            ],
          },
        ],
      },
    ],
  }
  const detailRoutes = over => ({
    '/events/50': { event: ev(50, T16_1300, { status: { type: 'finished' } }) },
    '/events/50/incidents': {
      incidents: [{ incidentType: 'goal', time: 10, isHome: true, player: { name: 'G' } }, null],
    },
    '/events/50/statistics': xgStats,
    '/events/50/lineups': { home: { formation: '4-4-2', players: [] } },
    '/events/50/graph': { graphPoints: [{ value: 50 }, { value: -25 }] },
    ...over,
  })

  test("odatiy: vote xG'dan, meta.unavailable bo'sh", async () => {
    routes(detailRoutes({}))
    const d = await sofa.matchDetail(50)
    assert.equal(d.events.length, 1)
    assert.deepEqual(d.momentum, [100, -50])
    assert.ok(d.vote.home > d.vote.away)
    assert.deepEqual(d.stats[1], { label: 'Corners', home: '3', away: null, bar: true }) // String(undefined) emas
    assert.deepEqual(d.meta, { unavailable: [] })
  })

  test("404 qism = mavjud emas (unavailable emas); 503 qism = unavailable; xG yo'q → vote null", async () => {
    routes(detailRoutes({ '/events/50/statistics': status(404), '/events/50/graph': status(503) }))
    const d = await sofa.matchDetail(50)
    assert.deepEqual(d.stats, [])
    assert.equal(d.vote, null)
    assert.deepEqual(d.momentum, [])
    assert.deepEqual(d.meta.unavailable, ['momentum'])
  })

  test("o'yin 404 → NotFound; 503 → Upstream; 200 + eventsiz → UpstreamError", async () => {
    routes({ '/events/51': status(404), '/events/52': status(503), '/events/53': { foo: 1 } })
    await assert.rejects(sofa.matchDetail(51), NotFoundError)
    await assert.rejects(sofa.matchDetail(52), isUpstream())
    await assert.rejects(sofa.matchDetail(53), e => isUpstream()(e) && /yaroqsiz/.test(e.message))
  })
})

describe('league()', () => {
  const base = '/tournaments/17/season/77'
  const leagueRoutes = over => ({
    '/tournaments/17/seasons': { seasons: [{ id: 77, year: '26/27' }] },
    '/tournaments/17': { uniqueTournament: { name: 'PL', category: { name: 'England' } } },
    [`${base}/standings`]: {
      standings: [{ name: 'G', rows: [{ position: 1, team: { id: 9, name: 'T' }, wins: 3, points: 9 }] }],
    },
    [`${base}/standings/home`]: status(404),
    [`${base}/standings/away`]: status(404),
    [`${base}/rounds`]: status(503),
    [`${base}/events/last`]: { events: [ev(1, T16_1300)] },
    [`${base}/events/next`]: { events: [] },
    [`${base}/top-players/overall`]: status(404),
    ...over,
  })

  test("uy/mehmon bo'linishi yo'q → null (uydirma emas); 503 bo'lim → meta.unavailable", async () => {
    routes(leagueRoutes({}))
    const l = await sofa.league(17)
    const row = l.groups[0].rows[0]
    assert.equal(row.home, null)
    assert.equal(row.away, null)
    assert.deepEqual(row.total, { w: 3, d: null, l: null })
    assert.equal(l.matches.length, 1)
    assert.deepEqual(l.scorers, [])
    assert.deepEqual(l.meta.unavailable, ['stages'])
    assert.equal(l.groups[0].name, 'G')
  })

  test("liga/guruh nomi yo'q → null (uydirma 'Liga'/'Jadval' emas)", async () => {
    routes(
      leagueRoutes({
        '/tournaments/17': { uniqueTournament: {} },
        [`${base}/standings`]: { standings: [{ rows: [] }] },
      }),
    )
    const l = await sofa.league(17)
    assert.equal(l.league.name, null)
    assert.equal(l.groups[0].name, null)
  })

  test('liga 404 → NotFound; turnir 503 → Upstream', async () => {
    routes(leagueRoutes({ '/tournaments/17': status(404) }))
    await assert.rejects(sofa.league(17), NotFoundError)
    clearCache()
    routes(leagueRoutes({ '/tournaments/17': status(503) }))
    await assert.rejects(sofa.league(17), isUpstream())
  })
})

describe('team()', () => {
  test("awarded/hisobsiz o'yin yiqitmaydi; forma winnerCode'dan; 503 bo'lim → meta.unavailable", async () => {
    const fin = { status: { type: 'finished' } }
    routes({
      '/teams/10': { team: { id: 10, name: 'T' } },
      '/teams/10/players': status(503),
      '/teams/10/events/last': {
        events: [
          ev(100, T16_0130, { ...fin, homeTeam: { id: 10 }, homeScore: {}, awayScore: {}, winnerCode: 1 }),
          ev(101, T16_0130 + 10, { ...fin, homeTeam: { id: 10 } }),
          ev(102, T16_0130 + 20, {
            ...fin,
            awayTeam: { id: 10 },
            homeScore: { current: 2 },
            awayScore: { current: 2 },
          }),
          ev(103, undefined, fin),
        ],
      },
      '/teams/10/events/next': status(404),
    })
    const t = await sofa.team(10)
    assert.deepEqual(t.form, ['G', 'D'])
    assert.equal(t.matches.length, 3)
    assert.deepEqual(t.squad, [])
    assert.deepEqual(t.meta.unavailable, ['squad'])
    assert.deepEqual(
      [t.info.stadium, t.info.city, t.info.coach, t.info.founded, t.league.name],
      [null, null, null, null, null],
    )
  })

  test('jamoa 404 → NotFound; 503 → Upstream; 200 + team yo`q → Upstream', async () => {
    const subs = id =>
      Object.fromEntries(['players', 'events/last', 'events/next'].map(s => [`/teams/${id}/${s}`, status(404)]))
    routes({
      '/teams/11': status(404),
      '/teams/12': status(503),
      '/teams/13': {},
      ...subs(11),
      ...subs(12),
      ...subs(13),
    })
    await assert.rejects(sofa.team(11), NotFoundError)
    await assert.rejects(sofa.team(12), isUpstream())
    await assert.rejects(sofa.team(13), isUpstream())
  })
})

describe('player() / playerSeason() / playerCareer()', () => {
  const pl = { player: { id: 3, name: 'P', position: 'F', team: { id: 1 } } }

  test("atributlar yo'q → attrs/strengths/weaknesses []; 503 bo'lim → meta.unavailable", async () => {
    routes({
      '/players/3': pl,
      '/players/3/attribute-overviews': status(404),
      '/players/3/statistics/seasons': { uniqueTournamentSeasons: [] },
      '/players/3/events/last': { events: [ev(1, T16_1300, { winnerCode: 1 })] },
      '/players/3/last-year-summary': status(503),
    })
    const p = await sofa.player(3)
    assert.deepEqual([p.attrs, p.strengths, p.weaknesses], [[], [], []])
    assert.equal(p.recent[0].result, 'G')
    assert.deepEqual(p.meta.unavailable, ['monthly'])
    // '—' sentinel emas — null (frontend o'zi "—" chiqaradi)
    assert.deepEqual(
      [p.rating, p.value, p.valueText, p.base.height, p.base.foot, p.base.age, p.base.number],
      [null, null, null, null, null, null, null],
    )
  })

  test("o'yinchi 404 → NotFound; 200 + player yo'q → Upstream", async () => {
    routes({ '/players/4': status(404), '/players/5': {} })
    await assert.rejects(sofa.player(4), NotFoundError)
    await assert.rejects(sofa.playerSeason(5, 17, 77), isUpstream())
  })

  test('playerSeason: statistika 404 → nollar; 503 → UpstreamError', async () => {
    const seasonRoutes = statHandler => ({
      '/players/3': pl,
      '/players/3/statistics/17/77': statHandler,
      '/players/3/heatmap/17/77': status(404),
      '/players/3/last-year-summary': { summary: [] },
      '/players/3/events/last': { events: [] },
    })
    routes(seasonRoutes(status(404)))
    const s = await sofa.playerSeason(3, 17, 77)
    assert.equal(s.summary.appearances, 0)
    assert.equal(s.summary.goals, 0)
    assert.deepEqual(s.meta.unavailable, [])
    clearCache()
    routes(seasonRoutes({ statistics: { appearances: 3, rating: 7.25 } })) // maydonlar qisman
    const s2 = await sofa.playerSeason(3, 17, 77)
    assert.deepEqual(
      [s2.summary.appearances, s2.summary.rating, s2.summary.goals, s2.summary.minutesPerGame],
      [3, '7.25', null, null],
    )
    clearCache()
    routes(seasonRoutes(status(503)))
    await assert.rejects(sofa.playerSeason(3, 17, 77), isUpstream())
  })

  test('karera: ≤4 parallel, 16 ta cheklov → truncated, qisman → partial + failedSeasons', async () => {
    const seasons = Array.from({ length: 20 }, (_, i) => ({ id: 500 + i, year: String(2000 + i) }))
    let active = 0
    let peak = 0
    const stat = async (_o, url) => {
      active++
      peak = Math.max(peak, active)
      await new Promise(r => setTimeout(r, 5))
      active--
      return url.pathname.endsWith('/501') ? json({}, 500) : json({ statistics: { appearances: 1 } })
    }
    routes({
      '/players/3': pl,
      '/players/3/statistics/seasons': {
        uniqueTournamentSeasons: [{ uniqueTournament: { id: 17, name: 'PL' }, seasons }],
      },
      ...Object.fromEntries(seasons.slice(0, 16).map(s => [`/players/3/statistics/17/${s.id}`, stat])),
    })
    const res = await sofa.playerCareer(3)
    assert.ok(peak <= 4, `peak=${peak}`)
    assert.equal(res.rows.length, 15)
    assert.equal(res.truncated, true)
    assert.equal(res.partial, true)
    assert.deepEqual(res.failedSeasons, [{ tid: 17, sid: 501, tournament: 'PL', year: '2001' }])
  })

  test("karera: appearances yo'q → qator qoladi (null), aniq 0 → tashlanadi", async () => {
    routes({
      '/players/3': pl,
      '/players/3/statistics/seasons': {
        uniqueTournamentSeasons: [
          {
            uniqueTournament: { id: 17, name: 'PL' },
            seasons: [
              { id: 1, year: '1' },
              { id: 2, year: '2' },
            ],
          },
        ],
      },
      '/players/3/statistics/17/1': { statistics: { goals: 4 } },
      '/players/3/statistics/17/2': { statistics: { appearances: 0 } },
    })
    const res = await sofa.playerCareer(3)
    assert.equal(res.rows.length, 1)
    assert.deepEqual([res.rows[0].mp, res.rows[0].goals, res.rows[0].min, res.rows[0].rating], [null, 4, null, null])
    assert.equal(res.partial, false)
  })

  test('karera: barcha mavsumlar yiqilsa → UpstreamError', async () => {
    routes({
      '/players/3': pl,
      '/players/3/statistics/seasons': {
        uniqueTournamentSeasons: [{ uniqueTournament: { id: 17 }, seasons: [{ id: 1 }, { id: 2 }] }],
      },
      '/players/3/statistics/17/1': status(503),
      '/players/3/statistics/17/2': status(500),
    })
    await assert.rejects(sofa.playerCareer(3), isUpstream())
  })
})

describe('coach() / referee()', () => {
  test("murabbiy: berilmagan raqamlar null; o'yinlar 503 → meta.unavailable; 404 → NotFound", async () => {
    routes({
      '/managers/7': {
        manager: {
          id: 7,
          name: 'M',
          performance: { total: 10, wins: 5, totalPoints: 18 },
          teams: [{ id: 1, name: 'T' }],
        },
      },
      '/managers/7/events/last': status(503),
      '/managers/8': status(404),
      '/managers/8/events/last': status(404),
    })
    const c = await sofa.coach(7)
    assert.deepEqual(c.record, { games: 10, w: 5, d: null, l: null, ppg: '1.80', winPct: 50 })
    assert.equal(c.totalTrophies, null)
    assert.deepEqual(c.career[0], {
      club: 'T',
      id: 1,
      c: '#444',
      from: null,
      to: null,
      games: null,
      ppg: null,
      trophies: null,
    })
    assert.deepEqual(c.meta.unavailable, ['matches'])
    await assert.rejects(sofa.coach(8), NotFoundError)
  })

  test("hakam: pen/id null, o'yinlar teskari tartibda; 503 → Upstream", async () => {
    routes({
      '/referees/9': { referee: { id: 9, name: 'R', games: 4, yellowCards: 8, redCards: 1 } },
      '/referees/9/events/last': { events: [ev(1, T15_1500), ev(2, T16_1300)] },
      '/referees/10': status(503),
      '/referees/10/events/last': status(404),
    })
    const r = await sofa.referee(9)
    assert.deepEqual(r.totals, { apps: 4, yellow: 8, red: 1, pen: null })
    assert.equal(r.career[0].id, null)
    assert.equal(r.career[0].avgYellow, '2.00')
    assert.deepEqual(
      r.matches.map(m => m.id),
      ['2', '1'],
    )
    await assert.rejects(sofa.referee(10), isUpstream())
  })
})

describe('countries / countryLeagues / rankings', () => {
  test('odatiy javoblar; 503 → Upstream; noma`lum reyting turi → BadRequest', async () => {
    routes({
      '/categories': { categories: [{ id: 2, name: 'Spain' }, { id: 1, name: 'England' }, { id: 3 }] },
      '/category/1/tournaments': { groups: [{ uniqueTournaments: [{ id: 17, name: 'PL' }] }, {}] },
      '/rankings/1': { rankings: [{ ranking: 1, team: { id: 5, name: 'Real' }, points: 120.6 }, null] },
      '/rankings/2': status(503),
    })
    assert.deepEqual(await sofa.countries(), [
      { id: 1, name: 'England' },
      { id: 2, name: 'Spain' },
    ])
    assert.deepEqual(await sofa.countryLeagues(1), [{ id: 17, name: 'PL' }])
    assert.deepEqual(await sofa.rankings('uefa'), [{ rank: 1, name: 'Real', teamId: 5, points: 121, prev: null }])
    await assert.rejects(sofa.rankings('fifa'), isUpstream())
    await assert.rejects(sofa.rankings('xyz'), BadRequestError)
  })
})

describe('fetchImage()', () => {
  const img =
    (headers, body = new Uint8Array([1, 2, 3])) =>
    () =>
      new Response(body, { headers })

  test('200 + text/html → UpstreamError (rasm emas)', async () => {
    routes({ '/images/team/1': img({ 'content-type': 'text/html' }) })
    await assert.rejects(sofa.fetchImage('team', 1), e => isUpstream()(e) && /rasm emas/.test(e.message))
  })

  test('image/png → {buf, type}, LRU keshdan qayta beriladi', async () => {
    routes({ '/images/team/2': img({ 'content-type': 'image/png' }) })
    const a = await sofa.fetchImage('team', 2)
    const b = await sofa.fetchImage('team', 2)
    assert.equal(a.type, 'image/png')
    assert.deepEqual([...a.buf], [1, 2, 3])
    assert.equal(b, a)
    assert.equal(calls.length, 1)
  })

  test("katta rasm: Content-Length bo'yicha va oqim bo'yicha (sarlavhasiz) → UpstreamError", async () => {
    const big = new Uint8Array(2 * 1024 * 1024 + 1)
    routes({
      '/images/team/3': img({ 'content-type': 'image/png', 'content-length': '3000000' }),
      '/images/team/4': img({ 'content-type': 'image/png' }, new Blob([big]).stream()),
    })
    await assert.rejects(sofa.fetchImage('team', 3), e => isUpstream()(e) && /katta/.test(e.message))
    await assert.rejects(sofa.fetchImage('team', 4), e => isUpstream()(e) && /katta/.test(e.message))
  })

  test('404 → NotFound, qisqa negativ kesh (fetch bir marta); 403 → Upstream', async () => {
    routes({ '/images/team/5': status(404), '/images/team/6': status(403) })
    await assert.rejects(sofa.fetchImage('team', 5), NotFoundError)
    await assert.rejects(sofa.fetchImage('team', 5), NotFoundError)
    await assert.rejects(sofa.fetchImage('team', 6), isUpstream())
    assert.deepEqual(paths(), ['/images/team/5', '/images/team/6'])
  })
})

describe('news / article / home', () => {
  const post = (id, title) => ({
    id,
    slug: `s-${id}`,
    section: 'football',
    image: 'i.png',
    title,
    excerpt: `ex ${id}`,
    date: '2026-10-15T10:00:00Z',
    categories: ['la-liga'],
  })

  test("news: har maqolada translationComplete; noto'g'ri postlar tashlanadi; 503 → Upstream", async () => {
    const noCat = { ...post(2, 'News two'), categories: ['football'] }
    routes({ '/news': { posts: [post(1, 'News one'), null, { section: 'tennis' }, noCat] }, google: gt })
    const list = await sofa.news()
    assert.equal(list.length, 2)
    assert.equal(list[1].league, null) // uydirma 'Futbol' emas
    assert.equal(list[0].title, 'UZ:News one')
    assert.equal(list[0].league, 'La Liga')
    assert.equal(list[0].translationComplete, true)
    clearCache()
    routes({ '/news': status(503) })
    await assert.rejects(sofa.news(), isUpstream())
  })

  test('article: tarjima ishlamasa translationComplete=false; null bloklar xavfsiz', async () => {
    routes({
      '/news/a-1': {
        id: 1,
        slug: 'a-1',
        title: 'Unique title one',
        excerpt: 'Ex one',
        blocks: [{ type: 'p', text: 'Body one' }, null, { type: 'p' }],
        url: 'https://x',
      },
      google: status(500),
    })
    const a = await sofa.article('a-1')
    assert.equal(a.translationComplete, false)
    assert.equal(a.title, 'Unique title one')
    assert.deepEqual(a.blocks, [{ type: 'p', text: 'Body one' }])
  })

  test("article: to'liq tarjima → true; sarlavhasiz → NotFound", async () => {
    routes({
      '/news/a-2': { id: 2, slug: 'a-2', title: 'Second headline', blocks: [] },
      '/news/a-3': { id: 3 },
      google: gt,
    })
    const a = await sofa.article('a-2')
    assert.equal(a.translationComplete, true)
    assert.equal(a.title, 'UZ:Second headline')
    await assert.rejects(sofa.article('a-3'), NotFoundError)
  })

  test('home: barcha manbalar yiqilsa UpstreamError', async () => {
    atTashkent16()
    routes({ '/news': status(500), ...sched(status(500), status(500)) })
    await assert.rejects(sofa.home(), isUpstream())
  })

  test("home: o'yinlar yiqilsa source='live' + unavailable; canceled fixtures'ga kirmaydi", async () => {
    atTashkent16()
    routes({ '/news': { posts: [post(1, 'Hello world')] }, ...sched(status(500), status(500)), google: gt })
    const h = await sofa.home()
    assert.equal(h.lead.title, 'UZ:Hello world')
    assert.deepEqual(h.meta, { source: 'live', unavailable: ['results', 'fixtures', 'standings'], partial: false })
    clearCache()
    routes({
      '/news': status(503),
      ...sched({ events: [] }, { events: [ev(1, T16_1300), ev(2, T16_1300, { status: { type: 'canceled' } })] }),
      '/tournaments/17/season/77/standings': status(404),
    })
    const h2 = await sofa.home()
    assert.equal(h2.lead, null)
    assert.deepEqual(h2.meta, { source: null, unavailable: ['news'], partial: false })
    assert.deepEqual(
      h2.fixtures.map(f => f.home),
      ['A'],
    )
  })
})
