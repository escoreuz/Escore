// app.js (createApp) integratsiya testlari: validatsiya, xato xaritalash, demo ajratish, yozish, rasm, maqola.
// Haqiqiy HTTP (listen(0)), sofa deps orqali mock; store vaqtinchalik papkada. server/db ga tegilmaydi.
import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'

import { createApp } from '../app.js'
import { UpstreamError, NotFoundError, BadRequestError } from '../errors.js'
import { createDemoAdapter } from '../demo/adapter.js'
import { TOKEN, closeAll, fakeArchive, fakeSofa, start } from './app.helpers.js'

after(closeAll)

describe('crash fix va validatsiya', () => {
  test('prototip kalitli ID → 400, server tirik qoladi', async () => {
    const { call } = await start()
    for (const path of ['/api/leagues/constructor', '/api/leagues/__proto__', '/api/teams/toString']) {
      const res = await call(path)
      assert.equal(res.status, 400, path)
      assert.equal((await res.json()).code, 'BAD_REQUEST')
    }
    assert.equal((await call('/api/health')).status, 200)
  })

  test('demo rejimda constructor → 404 (Map orqali qidiruv), server tirik', async () => {
    const demo = createDemoAdapter({ today: '2026-10-15' })
    const { call } = await start({ sofa: demo, mode: 'demo' })
    const res = await call('/api/leagues/constructor')
    assert.equal(res.status, 404)
    assert.equal((await call('/api/leagues/__proto__')).status, 400)
    const epl = await call('/api/leagues/epl')
    assert.equal(epl.status, 200)
    assert.equal((await call('/api/health')).status, 200)
  })

  test('sana, q, status va season tekshiriladi', async () => {
    const { call } = await start()
    assert.equal((await call('/api/matches?date=2026-02-30')).status, 400)
    assert.equal((await call('/api/matches?date=bugun')).status, 400)
    assert.equal((await call(`/api/matches?q=${'a'.repeat(81)}`)).status, 400)
    assert.equal((await call('/api/matches?q=a&q=b')).status, 400)
    assert.equal((await call('/api/matches?status=boshqa')).status, 400)
    assert.equal((await call('/api/leagues/17?season=abc')).status, 400)
    assert.equal((await call('/api/players/5/season')).status, 400)
    const ok = await call('/api/matches?date=2026-10-14&q=' + 'a'.repeat(80))
    assert.equal(ok.status, 200)
    assert.deepEqual(await ok.json(), { date: '2026-10-14', matches: [], liveCount: 0, partial: false })
  })

  test('matches: adapterning partial belgisi uzatiladi', async () => {
    const matches = [{ id: 1, status: 'live', home: { n: 'A' }, away: { n: 'B' } }]
    const { call } = await start({ sofa: fakeSofa({ matchesForDate: async () => ({ matches, partial: true }) }) })
    const body = await (await call('/api/matches')).json()
    assert.equal(body.partial, true)
    assert.equal(body.liveCount, 1)
  })
})

describe('xato xaritalash (FIX-PLAN 2.1)', () => {
  test('UpstreamError → 503 UPSTREAM_UNAVAILABLE, ichki xabar javobda yo`q', async () => {
    const { call } = await start()
    const res = await call('/api/teams/42')
    assert.equal(res.status, 503)
    const body = await res.json()
    assert.equal(body.code, 'UPSTREAM_UNAVAILABLE')
    assert.ok(!JSON.stringify(body).includes('score-api'))
    assert.equal((await call('/api/scorers')).status, 503)
  })

  test('NotFoundError → 404, kutilmagan xato → 500 INTERNAL (stack javobda yo`q)', async () => {
    const sofa = fakeSofa({
      team: async () => {
        throw new NotFoundError('team 404')
      },
      matchDetail: async () => {
        throw new TypeError('secret stack detail')
      },
    })
    const { call, logger } = await start({ sofa })
    const nf = await call('/api/teams/1')
    assert.equal(nf.status, 404)
    assert.equal((await nf.json()).code, 'NOT_FOUND')
    const boom = await call('/api/matches/1')
    assert.equal(boom.status, 500)
    const body = await boom.json()
    assert.deepEqual(body, { error: 'Server xatosi', code: 'INTERNAL' })
    assert.ok(logger.calls.error.length > 0)
  })

  test('BadRequestError → 400, ichki xabar yo`q; detal meta o`zgarmasdan uzatiladi', async () => {
    const sofa = fakeSofa({
      team: async () => {
        throw new BadRequestError('ichki yo`l /team/x')
      },
      matchDetail: async () => ({ match: { id: 1 }, meta: { unavailable: ['lineups'] } }),
    })
    const { call } = await start({ sofa })
    const bad = await call('/api/teams/1')
    assert.equal(bad.status, 400)
    const body = await bad.json()
    assert.equal(body.code, 'BAD_REQUEST')
    assert.ok(!JSON.stringify(body).includes('/team/x'))
    const detail = await (await call('/api/matches/1')).json()
    assert.deepEqual(detail.meta, { unavailable: ['lineups'] })
  })

  test('noma`lum yo`l → 404 JSON', async () => {
    const { call } = await start()
    const res = await call('/api/yoq')
    assert.equal(res.status, 404)
    assert.equal((await res.json()).code, 'NOT_FOUND')
  })
})

describe('demo real ma`lumotga aralashmaydi (FIX-PLAN §1, 2.2)', () => {
  test('featured: o`yin yo`q → null; jonli o`yin ustun', async () => {
    const empty = await start()
    const res = await empty.call('/api/featured')
    assert.equal(res.status, 200)
    assert.equal(await res.json(), null)
    const list = [
      { id: 1, status: 'sched' },
      { id: 2, status: 'live' },
    ]
    const withLive = await start({ sofa: fakeSofa({ matchesByDate: async () => list }) })
    assert.equal((await (await withLive.call('/api/featured')).json()).id, 2)
    // Faqat rejadagi o'yinlar — uydirma "featured" emas, null
    const schedOnly = await start({ sofa: fakeSofa({ matchesByDate: async () => [list[0]] }) })
    assert.equal(await (await schedOnly.call('/api/featured')).json(), null)
  })

  test('featured: adapterning pickFeatured qoidasi ishlatiladi', async () => {
    const sofa = fakeSofa({ matchesByDate: async () => [{ id: 7, status: 'ft' }], pickFeatured: m => m[0] })
    const { call } = await start({ sofa })
    assert.equal((await (await call('/api/featured')).json()).id, 7)
  })

  test('home: manba ishlamasa — store yangiliklari, jadval bo`sh, unavailable to`ldirilgan', async () => {
    const { call } = await start()
    const body = await (await call('/api/home')).json()
    assert.equal(body.meta.source, 'store')
    assert.deepEqual(body.meta.unavailable.sort(), ['fixtures', 'results', 'standings'])
    assert.deepEqual([body.standings, body.results, body.fixtures], [[], [], []])
    assert.equal(body.lead.slug, 'birinchi')
    assert.equal(body.quote, null)
  })

  test('home: manba ishlasa — source live', async () => {
    const home = async () => ({ lead: { slug: 'x', title: 'X' }, standings: [{ pos: 1 }], results: [], fixtures: [] })
    const { call } = await start({ sofa: fakeSofa({ home }) })
    const body = await (await call('/api/home')).json()
    assert.equal(body.meta.source, 'live')
    assert.deepEqual(body.meta.unavailable, [])
    assert.equal(body.standings.length, 1)
  })

  test('home: qisman xato — sofa meta.unavailable saqlanadi, yangilik yo`q bo`lsa store', async () => {
    const home = async () => ({
      lead: null,
      standings: [],
      results: [{ home: 'A' }],
      fixtures: [],
      meta: { source: 'live', unavailable: ['news', 'standings'] },
    })
    const { call } = await start({ sofa: fakeSofa({ home }) })
    const body = await (await call('/api/home')).json()
    assert.equal(body.meta.source, 'store')
    assert.deepEqual(body.meta.unavailable.sort(), ['news', 'standings'])
    assert.equal(body.lead.slug, 'birinchi')
    assert.equal(body.results.length, 1)
  })

  test('home: sofa meta.source null — store bilan to`ldiriladi, meta.partial saqlanadi', async () => {
    const home = async () => ({
      lead: { slug: 'eski', title: 'Eski' },
      briefs: ['x'],
      standings: [{ pos: 1 }],
      results: [],
      fixtures: [],
      meta: { source: null, unavailable: ['news'], partial: true },
    })
    const { call } = await start({ sofa: fakeSofa({ home }) })
    const body = await (await call('/api/home')).json()
    assert.deepEqual(body.meta, { source: 'store', unavailable: ['news'], partial: true })
    assert.equal(body.lead.slug, 'birinchi')
    assert.deepEqual(body.briefs, [])
    assert.equal(body.standings.length, 1)
  })

  test('bootstrap: faqat issue va ticker (sana/ob-havo/narx yo`q)', async () => {
    const { call } = await start()
    const body = await (await call('/api/bootstrap')).json()
    assert.deepEqual(Object.keys(body).sort(), ['issue', 'ticker'])
    assert.deepEqual(Object.keys(body.issue).sort(), ['city', 'no', 'volume'])
  })
})

describe('yozish endpointlari (FIX-PLAN 2.4)', () => {
  const post = (call, body, auth) =>
    call('/api/news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })

  test('ADMIN_TOKEN sozlanmagan — yozish o`chiq (403)', async () => {
    const { call } = await start()
    const res = await post(call, { title: 'Yangi' }, `Bearer ${TOKEN}`)
    assert.equal(res.status, 403)
    assert.equal((await res.json()).code, 'FORBIDDEN')
  })

  test('tokensiz 401, noto`g`ri token 403, yaroqsiz body 400, to`g`ri 201', async () => {
    const { call } = await start({ env: { ADMIN_TOKEN: TOKEN } })
    assert.equal((await post(call, { title: 'Yangi' })).status, 401)
    assert.equal((await post(call, { title: 'Yangi' }, 'Bearer notogri')).status, 403)
    assert.equal((await post(call, { title: 'Yangi' }, `Basic ${TOKEN}`)).status, 401)
    const bad = await post(call, { title: '', slug: 'x' }, `Bearer ${TOKEN}`)
    assert.equal(bad.status, 400)
    const badBody = await bad.json()
    assert.equal(badBody.code, 'BAD_REQUEST')
    assert.ok(Array.isArray(badBody.details) && badBody.details.length > 0)
    assert.equal((await post(call, '{buzilgan', `Bearer ${TOKEN}`)).status, 400)
    const ok = await post(call, { title: 'Yangi maqola' }, `Bearer ${TOKEN}`)
    assert.equal(ok.status, 201)
    assert.equal((await ok.json()).slug, 'yangi-maqola')
  })

  test('PUT/DELETE: tokensiz 401, yo`q maqola 404', async () => {
    const { call } = await start({ env: { ADMIN_TOKEN: TOKEN } })
    assert.equal((await call('/api/news/birinchi', { method: 'DELETE' })).status, 401)
    const auth = { Authorization: `Bearer ${TOKEN}` }
    assert.equal((await call('/api/news/yoq-maqola', { method: 'DELETE', headers: auth })).status, 404)
    assert.equal((await call('/api/news/birinchi', { method: 'DELETE', headers: auth })).status, 200)
  })

  test('qisqa ADMIN_TOKEN qabul qilinmaydi', async () => {
    const { call, logger } = await start({ env: { ADMIN_TOKEN: 'short' } })
    assert.equal((await post(call, { title: 'Yangi' }, 'Bearer short')).status, 403)
    assert.ok(logger.calls.warn.some(m => m.includes('ADMIN_TOKEN')))
  })
})

describe('rasm proksisi', () => {
  test('image/png → 200 + nosniff; noto`g`ri content-type/SVG → 404', async () => {
    const png = await start()
    const ok = await png.call('/api/img/team/17')
    assert.equal(ok.status, 200)
    assert.equal(ok.headers.get('content-type'), 'image/png')
    assert.equal(ok.headers.get('x-content-type-options'), 'nosniff')
    for (const type of ['text/html', 'image/svg+xml', '']) {
      const sofa = fakeSofa({ fetchImage: async () => ({ buf: Buffer.from('<script>'), type }) })
      const { call } = await start({ sofa })
      assert.equal((await call('/api/img/team/17')).status, 404, type)
    }
    assert.equal((await png.call('/api/img/evil/17')).status, 400)
    assert.equal((await png.call('/api/img/team/abc')).status, 400)
  })
})

describe('maqola: sourceUrl va tarjima', () => {
  test('javascript: sourceUrl → null; to`liq bo`lmagan tarjima arxivlanmaydi', async () => {
    const archive = fakeArchive()
    const article = async slug => ({ slug, title: 'T', sourceUrl: 'javascript:alert(1)', translationComplete: false })
    const { call } = await start({ sofa: fakeSofa({ article }), archive })
    const body = await (await call('/api/feed/test-slug')).json()
    assert.equal(body.sourceUrl, null)
    assert.equal(body.translationComplete, false)
    await new Promise(r => setImmediate(r))
    assert.deepEqual(archive.saved, [])
  })

  test('to`liq tarjima arxivlanadi; manba ishlamasa arxivdan qaytadi', async () => {
    const archive = fakeArchive({ eski: { slug: 'eski', title: 'Eski', sourceUrl: 'https://x.test/a' } })
    const article = async slug => {
      if (slug === 'eski') throw new UpstreamError('down')
      return { slug, title: 'T', sourceUrl: 'https://sofascore.com/a' }
    }
    const { call } = await start({ sofa: fakeSofa({ article }), archive })
    const fresh = await (await call('/api/feed/yangi')).json()
    assert.equal(fresh.translationComplete, true)
    await new Promise(r => setImmediate(r))
    assert.deepEqual(archive.saved, ['yangi'])
    const old = await call('/api/feed/eski')
    assert.equal(old.status, 200)
    assert.equal((await old.json()).sourceUrl, 'https://x.test/a')
  })
})

describe('createApp konfiguratsiyasi', () => {
  test('yaroqsiz SITE_URL — ishga tushishda xato', () => {
    assert.throws(
      () => createApp({ sofa: fakeSofa(), store: {}, archive: {}, env: { SITE_URL: 'javascript:x' } }),
      /SITE_URL/,
    )
  })
})
