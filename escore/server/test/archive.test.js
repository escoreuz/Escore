// archive.js testlari: dirty, debounce, chegara, flush, sahifalash, buzilgan fayl.
// Faqat vaqtinchalik papka ishlatiladi — haqiqiy server/db ga tegilmaydi.
import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import * as nodeFs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createArchive } from '../archive.js'

function silentLogger() {
  const calls = { warn: [], error: [] }
  return { calls, warn: msg => calls.warn.push(msg), error: msg => calls.error.push(msg) }
}
// Har chaqiruvda 1 ms oldinga yuradigan soat — savedAt tartibi deterministik
function tickingClock(start = 1_700_000_000_000) {
  let t = start
  return () => t++
}
// Haqiqiy fs ustiga o'rama: chaqiruvlarni sanaydi, kerak bo'lsa rename'ni N marta yiqitadi
function spyFs({ renameFailures = 0, code = 'EPERM', readError = null, quarantineError = null } = {}) {
  const calls = { mkdir: 0, rename: 0, rm: 0 }
  let failLeft = renameFailures
  const promises = {
    mkdir: (...a) => (calls.mkdir++, nodeFs.promises.mkdir(...a)),
    writeFile: (...a) => nodeFs.promises.writeFile(...a),
    rm: (...a) => (calls.rm++, nodeFs.promises.rm(...a)),
    rename: async (...a) => {
      calls.rename++
      if (failLeft-- > 0) throw Object.assign(new Error(code), { code })
      return nodeFs.promises.rename(...a)
    },
  }
  const readFileSync = (...a) => {
    if (readError) throw Object.assign(new Error(readError), { code: readError })
    return nodeFs.readFileSync(...a)
  }
  const renameSync = (...a) => {
    if (quarantineError) throw Object.assign(new Error(quarantineError), { code: quarantineError })
    return nodeFs.renameSync(...a)
  }
  return { calls, fs: { ...nodeFs, readFileSync, renameSync, promises } }
}
const card = (slug, extra = {}) => ({ slug, id: slug, title: `Sarlavha ${slug}`, league: 'LaLiga', ...extra })

let dir
let file
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'escore-archive-'))
  file = join(dir, 'archive.json')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const make = (opts = {}) =>
  createArchive({ file, debounceMs: 10_000, logger: silentLogger(), now: tickingClock(), ...opts })
const readJson = () => JSON.parse(readFileSync(file, 'utf8'))

describe('saveCards — dirty faqat haqiqiy o`zgarishda', () => {
  test('yangi element dirty qiladi, flush yozadi', async () => {
    const arch = make()
    arch.saveCards([card('a'), card('b')])
    assert.equal(arch.isDirty(), true)
    await arch.flush()
    assert.equal(arch.isDirty(), false)
    assert.deepEqual(Object.keys(readJson()).sort(), ['a', 'b'])
  })

  test("o'zgarmagan elementlar qayta kelsa dirty bo'lmaydi", async () => {
    const arch = make()
    arch.saveCards([card('a')])
    await arch.flush()
    arch.saveCards([card('a')])
    assert.equal(arch.isDirty(), false)
    arch.saveCards([card('a', { title: 'Yangi sarlavha' })])
    assert.equal(arch.isDirty(), true)
  })

  test("slug'siz va yaroqsiz elementlar e'tiborsiz qoldiriladi", () => {
    const arch = make()
    arch.saveCards([null, {}, { slug: 5 }, { slug: '' }])
    arch.saveCards('massiv emas')
    assert.equal(arch.count(), 0)
    assert.equal(arch.isDirty(), false)
  })

  test('savedAt va date birinchi saqlashdagidek qoladi', () => {
    const arch = make()
    arch.saveCards([card('a', { date: '2026-01-01T00:00:00Z' })])
    const first = arch.list().items[0]
    arch.saveCards([card('a', { date: '2026-05-05T00:00:00Z', title: 'Boshqa' })])
    assert.equal(arch.list().items[0].time, first.time)
  })
})

describe('debounce va yagona yozuvchi', () => {
  test('debounce oynasidagi saqlashlar bitta yozuvga birlashadi (mock taymer)', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const { calls, fs } = spyFs()
    const arch = make({ debounceMs: 3000, fs })
    arch.saveCards([card('a')])
    t.mock.timers.tick(1000)
    arch.saveCards([card('b')]) // taymer qayta boshlanmaydi
    t.mock.timers.tick(1999)
    assert.equal(calls.mkdir, 0, 'debounce tugamaguncha yozish boshlanmaydi')
    t.mock.timers.tick(1)
    assert.equal(calls.mkdir, 1, '3 s da bitta yozish boshlandi')
    await arch.flush()
    assert.equal(calls.rename, 1)
    assert.deepEqual(Object.keys(readJson()).sort(), ['a', 'b'])
    assert.equal(arch.isDirty(), false)
  })

  test('win32: rename EPERM vaqtinchalik bo`lsa qayta urinib yoziladi', async () => {
    const { calls, fs } = spyFs({ renameFailures: 2 })
    const logger = silentLogger()
    const arch = make({ fs, platform: 'win32', logger })
    arch.saveCards([card('a')])
    await arch.flush()
    assert.equal(calls.rename, 3)
    assert.deepEqual(Object.keys(readJson()), ['a'])
    assert.equal(logger.calls.error.length, 0)
  })

  test("win32 bo'lmasa qayta urinilmaydi: xato log, tmp o'chiriladi", async () => {
    const { calls, fs } = spyFs({ renameFailures: 1 })
    const logger = silentLogger()
    const arch = make({ fs, platform: 'linux', logger })
    arch.saveCards([card('a')])
    await arch.flush()
    assert.equal(calls.rename, 1)
    assert.equal(calls.rm, 1)
    assert.equal(logger.calls.error.length, 1)
    assert.deepEqual(readdirSync(dir), [], 'tmp qolmadi')
    assert.equal(arch.isDirty(), true)
  })

  test('win32: doimiy EBUSY — 1 + 3 urinishdan keyin taslim', async () => {
    const { calls, fs } = spyFs({ renameFailures: 99, code: 'EBUSY' })
    const arch = make({ fs, platform: 'win32' })
    arch.saveCards([card('a')])
    await arch.flush()
    assert.equal(calls.rename, 4)
    assert.equal(existsSync(file), false)
  })

  test('parallel flush va yozish paytidagi o`zgarishlar yo`qolmaydi, tmp qolmaydi', async () => {
    const arch = make()
    arch.saveCards([card('a')])
    const p1 = arch.flush()
    arch.saveCards([card('b')]) // birinchi yozish davomida
    const p2 = arch.flush()
    await Promise.all([p1, p2])
    assert.deepEqual(Object.keys(readJson()).sort(), ['a', 'b'])
    assert.deepEqual(readdirSync(dir), ['archive.json'])
  })

  test('toza holatda flush darhol tugaydi va fayl yaratmaydi', async () => {
    const arch = make()
    await arch.flush()
    assert.equal(existsSync(file), false)
  })

  test('yozish xatosi log qilinadi va dirty saqlanadi', async () => {
    const logger = silentLogger()
    const arch = make({ logger })
    mkdirSync(`${file}.tmp-${process.pid}`) // tmp yo'li papka — yozish ham, tmp ni o'chirish ham yiqiladi
    arch.saveCards([card('a')])
    await arch.flush()
    assert.equal(logger.calls.error.length, 2, "yozish xatosi + tmp o'chmagani")
    assert.match(logger.calls.error[0], /yozib bo'lmadi/)
    assert.match(logger.calls.error[1], /tmp/)
    assert.equal(arch.isDirty(), true)
  })
})

describe('elementlar soni chegarasi', () => {
  test("chegaradan oshganda eng eskilari o'chadi", async () => {
    const arch = make({ maxItems: 3 })
    for (const s of ['a', 'b', 'c', 'd', 'e']) arch.saveCards([card(s)])
    assert.equal(arch.count(), 3)
    assert.deepEqual(
      arch.list().items.map(i => i.slug),
      ['e', 'd', 'c'],
    )
    await arch.flush()
    assert.deepEqual(Object.keys(readJson()).sort(), ['c', 'd', 'e'])
  })
})

describe('saveArticle', () => {
  const article = { slug: 'm1', id: 1, title: 'Maqola', excerpt: 'Qisqa', blocks: [{ text: 'Matn' }] }

  test('translationComplete=false bo`lsa saqlanmaydi', () => {
    const arch = make()
    assert.equal(arch.saveArticle({ ...article, translationComplete: false }), false)
    assert.equal(arch.getArticle('m1'), null)
    assert.equal(arch.isDirty(), false)
  })

  test("translationComplete true yoki yo'q bo'lsa saqlanadi va arxivdan o'qiladi", () => {
    const arch = make()
    assert.equal(arch.saveArticle({ ...article, translationComplete: true }), true)
    assert.equal(arch.saveArticle({ ...article, slug: 'm2' }), true)
    const got = arch.getArticle('m1')
    assert.equal(got.fromArchive, true)
    assert.deepEqual(got.blocks, [{ text: 'Matn' }])
    assert.equal(arch.list({ q: 'matn' }).total, 2, "bloklar matni bo'yicha qidiriladi")
  })

  test("bo'sh/yo'q maydonlar avvalgi qiymatni o'chirmaydi", () => {
    const arch = make()
    arch.saveArticle({ ...article, author: 'Muallif', sourceUrl: 'https://example.com/m1' })
    arch.saveArticle({ slug: 'm1', blocks: [], excerpt: '', author: undefined, sourceUrl: null, title: '' })
    const got = arch.getArticle('m1')
    assert.deepEqual(got.blocks, [{ text: 'Matn' }])
    assert.equal(got.excerpt, 'Qisqa')
    assert.equal(got.author, 'Muallif')
    assert.equal(got.sourceUrl, 'https://example.com/m1')
    assert.equal(got.title, 'Maqola')
  })

  test("bir xil maqola qayta saqlansa dirty bo'lmaydi", async () => {
    const arch = make()
    arch.saveArticle(article)
    await arch.flush()
    arch.saveArticle(article)
    assert.equal(arch.isDirty(), false)
  })
})

describe('list — sahifalash', () => {
  const filled = () => {
    const arch = make()
    for (let i = 0; i < 30; i++) arch.saveCards([card(`s${i}`, { league: i % 3 === 0 ? 'EPL' : 'LaLiga' })])
    return arch
  }

  test('shakl: { items, total, page, size, hasMore }', () => {
    const res = filled().list({ page: 0, size: 10 })
    assert.equal(res.items.length, 10)
    assert.equal(res.total, 30)
    assert.equal(res.page, 0)
    assert.equal(res.size, 10)
    assert.equal(res.hasMore, true)
    assert.equal(res.items[0].slug, 's29', 'eng yangisi birinchi')
    assert.ok(Array.isArray(res.categories))
  })

  test("oxirgi sahifada hasMore=false, chegaradan tashqarida bo'sh", () => {
    const arch = filled()
    const last = arch.list({ page: 2, size: 10 })
    assert.equal(last.items.length, 10)
    assert.equal(last.hasMore, false)
    assert.deepEqual(arch.list({ page: 5, size: 10 }).items, [])
  })

  test('size 1..50 ga, page 0 dan kichik emas qilib cheklanadi', () => {
    const arch = filled()
    assert.equal(arch.list({ size: 0 }).size, 1)
    assert.equal(arch.list({ size: 999 }).size, 50)
    assert.equal(arch.list({ size: 'abc' }).size, 24)
    assert.equal(arch.list({ page: -5 }).page, 0)
    assert.equal(arch.list({ page: 'x' }).page, 0)
    assert.equal(arch.list().size, 24)
  })

  test('kategoriya va qidiruv filtrlari', () => {
    const arch = filled()
    assert.equal(arch.list({ category: 'epl' }).total, 10)
    assert.equal(arch.list({ q: 'Sarlavha s1' }).total, 11) // s1, s10..s19
    assert.equal(arch.list({ q: 'topilmaydi' }).total, 0)
  })
})

describe('buzilgan arxiv fayli', () => {
  test("buzilgan JSON log qilinadi, .corrupt-<ts> nusxa qoladi, bo'sh bilan davom etadi", async () => {
    writeFileSync(file, '{"a": {buzuq', 'utf8')
    const logger = silentLogger()
    const arch = make({ logger })
    assert.equal(arch.count(), 0)
    assert.equal(logger.calls.error.length, 1)
    const corrupt = readdirSync(dir).filter(n => /^archive\.json\.corrupt-\d+$/.test(n))
    assert.equal(corrupt.length, 1)
    assert.equal(readFileSync(join(dir, corrupt[0]), 'utf8'), '{"a": {buzuq')
    arch.saveCards([card('yangi')])
    await arch.flush()
    assert.deepEqual(Object.keys(readJson()), ['yangi'])
  })

  test('massiv JSON ham buzilgan; yaroqsiz yozuvlar filtrlanadi', () => {
    writeFileSync(file, '[1,2]', 'utf8')
    assert.equal(make().count(), 0)
    writeFileSync(file, JSON.stringify({ ok: { slug: 'ok' }, bad: 5, nos: { title: 'x' } }), 'utf8')
    assert.equal(make().count(), 1)
  })
})

describe("o'qib bo'lmaydigan fayl va maxsus kalitlar", () => {
  test("o'qib bo'lmaydigan fayl: log, faqat xotirada, diskka yozilmaydi", async () => {
    const { calls, fs } = spyFs({ readError: 'EACCES' })
    const logger = silentLogger()
    const arch = make({ fs, logger })
    assert.equal(logger.calls.error.length, 1)
    arch.saveCards([card('a')])
    assert.equal(arch.count(), 1)
    await arch.flush()
    assert.equal(calls.mkdir, 0)
    assert.equal(existsSync(file), false)
  })

  test("buzilgan faylni ko'chirib bo'lmasa ustidan yozilmaydi", async () => {
    writeFileSync(file, '{buzuq', 'utf8')
    const { fs } = spyFs({ quarantineError: 'EPERM' })
    const logger = silentLogger()
    const arch = make({ fs, logger })
    arch.saveCards([card('a')])
    await arch.flush()
    assert.equal(readFileSync(file, 'utf8'), '{buzuq')
    assert.equal(logger.calls.error.length, 1)
  })

  test("constructor va __proto__ slug'lari oddiy kalit sifatida saqlanadi va qayta yuklanadi", async () => {
    const arch = make()
    arch.saveCards([card('constructor'), card('__proto__'), card('toString')])
    assert.equal(arch.count(), 3)
    await arch.flush()
    const reloaded = make()
    assert.equal(reloaded.count(), 3)
    assert.deepEqual(
      reloaded
        .list()
        .items.map(i => i.slug)
        .sort(),
      ['__proto__', 'constructor', 'toString'],
    )
    assert.equal({}.slug, undefined, 'prototip ifloslanmagan')
  })

  test('yuklashda kalit va slug mos kelmagan yozuvlar tashlanadi', () => {
    writeFileSync(file, JSON.stringify({ a: { slug: 'b' }, c: { slug: 'c' } }), 'utf8')
    const arch = make()
    assert.equal(arch.count(), 1)
    assert.equal(arch.list().items[0].slug, 'c')
  })
})

describe('standart eksportlar', () => {
  test("flush instance yaratilmagan bo'lsa ham resolve bo'ladi; eksport nomlari saqlangan", async () => {
    const mod = await import('../archive.js')
    for (const name of ['saveCards', 'saveArticle', 'getArticle', 'list', 'count', 'flush']) {
      assert.equal(typeof mod[name], 'function', name)
    }
    await mod.flush()
  })
})
