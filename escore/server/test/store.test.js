// store.js testlari: validatsiya, mass-assignment, atomik yozish, buzilgan fayldan tiklash.
// Faqat vaqtinchalik papka ishlatiladi — haqiqiy server/db ga tegilmaydi.
import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs'
import * as nodeFs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStore, validateArticle, ArticleValidationError } from '../store.js'

const SEED = [
  { slug: 'birinchi', title: 'Birinchi maqola', standfirst: 'Kirish', section: 'LIGA', body: ['Matn bir'] },
  { slug: 'ikkinchi', title: 'Ikkinchi maqola', standfirst: '', section: 'TRANSFER', body: ['Matn ikki'] },
]

function silentLogger() {
  const calls = { warn: [], error: [] }
  return { calls, warn: msg => calls.warn.push(msg), error: msg => calls.error.push(msg) }
}

let dir
let file
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'escore-store-'))
  file = join(dir, 'news.json')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const readJson = p => JSON.parse(readFileSync(p, 'utf8'))
const str = n => 'x'.repeat(n)

describe('validateArticle — odatiy', () => {
  test("to'liq to'g'ri kiritma qabul qilinadi va matnlar trim qilinadi", () => {
    const res = validateArticle({
      title: '  Sarlavha  ',
      standfirst: 'Kirish',
      excerpt: 'Qisqa',
      kicker: 'KICKER',
      section: 'LIGA',
      author: 'A. Muallif',
      body: ['  Birinchi xatboshi ', '', 'Ikkinchi'],
      image: 'https://example.com/a.jpg',
      date: '2026-10-15',
      tags: ['liga', 'gol'],
    })
    assert.equal(res.ok, true)
    assert.equal(res.value.title, 'Sarlavha')
    assert.deepEqual(res.value.body, ['Birinchi xatboshi', 'Ikkinchi'])
    assert.equal(res.value.image, 'https://example.com/a.jpg')
    assert.deepEqual(res.value.tags, ['liga', 'gol'])
  })

  test("partial rejimda bo'sh obyekt va bitta maydon qabul qilinadi", () => {
    assert.deepEqual(validateArticle({}, { partial: true }), { ok: true, value: {} })
    assert.deepEqual(validateArticle({ author: 'B' }, { partial: true }), { ok: true, value: { author: 'B' } })
  })

  test("image bo'sh satr bo'lishi mumkin", () => {
    const res = validateArticle({ title: 'T', image: '' })
    assert.equal(res.ok, true)
    assert.equal(res.value.image, '')
  })
})

describe('validateArticle — salbiy', () => {
  for (const bad of [null, undefined, 'matn', 42, ['title']]) {
    test(`obyekt emas: ${JSON.stringify(bad)}`, () => {
      const res = validateArticle(bad)
      assert.equal(res.ok, false)
      assert.ok(res.errors.length > 0)
    })
  }

  test('title yaratishda majburiy', () => {
    const res = validateArticle({ standfirst: 'faqat kirish' })
    assert.equal(res.ok, false)
    assert.ok(res.errors.includes('title majburiy'))
  })

  test("partial rejimda title bo'sh satrga almashtirilmaydi", () => {
    assert.equal(validateArticle({ title: '   ' }, { partial: true }).ok, false)
  })

  test("noto'g'ri turlar rad etiladi", () => {
    const res = validateArticle({ title: 5, body: 'bitta matn', tags: 'gol', image: 7, author: {} })
    assert.equal(res.ok, false)
    assert.equal(res.errors.length, 5)
  })

  test("body ichida matn bo'lmagan element rad etiladi", () => {
    assert.equal(validateArticle({ title: 'T', body: ['ok', { html: '<script>' }] }).ok, false)
  })

  for (const url of ['javascript:alert(1)', 'data:image/png;base64,AAAA', 'ftp://x.uz/a.jpg', 'nisbiy/yol.jpg']) {
    test(`image http(s) bo'lmasa rad etiladi: ${url}`, () => {
      const res = validateArticle({ title: 'T', image: url })
      assert.equal(res.ok, false)
      assert.match(res.errors[0], /http\(s\)/)
    })
  }

  test('ruxsat etilmagan maydonlar (slug, isAdmin, __proto__) rad etiladi', () => {
    const input = JSON.parse('{"title":"T","slug":"boshqa","isAdmin":true,"__proto__":{"x":1}}')
    const res = validateArticle(input)
    assert.equal(res.ok, false)
    assert.equal(res.errors.filter(e => e.startsWith('Ruxsat etilmagan')).length, 3)
  })
})

describe('validateArticle — chegaraviy', () => {
  const cases = [
    ['title', 200],
    ['standfirst', 600],
    ['excerpt', 600],
    ['kicker', 80],
    ['section', 80],
    ['author', 80],
    ['date', 40],
  ]
  for (const [field, max] of cases) {
    test(`${field}: ${max} belgi qabul, ${max + 1} rad`, () => {
      assert.equal(validateArticle({ title: 'T', [field]: str(max) }).ok, true)
      assert.equal(validateArticle({ title: 'T', [field]: str(max + 1) }).ok, false)
    })
  }

  test('body: 60 element qabul, 61 rad; element 6000 qabul, 6001 rad', () => {
    assert.equal(validateArticle({ title: 'T', body: Array(60).fill('a') }).ok, true)
    assert.equal(validateArticle({ title: 'T', body: Array(61).fill('a') }).ok, false)
    assert.equal(validateArticle({ title: 'T', body: [str(6000)] }).ok, true)
    assert.equal(validateArticle({ title: 'T', body: [str(6001)] }).ok, false)
  })

  test('tags: 10 qabul, 11 rad', () => {
    assert.equal(validateArticle({ title: 'T', tags: Array(10).fill('t') }).ok, true)
    assert.equal(validateArticle({ title: 'T', tags: Array(11).fill('t') }).ok, false)
  })
})

describe('createStore — CRUD va mass-assignment', () => {
  test("fayl yo'q bo'lsa seed bilan yaratiladi", () => {
    const store = createStore({ file, seed: SEED, logger: silentLogger() })
    assert.equal(store.listArticles().length, 2)
    assert.deepEqual(readJson(file), SEED)
    assert.equal(store.listArticles()[0].body, undefined, "ro'yxatda body yo'q")
  })

  test('createArticle slugni serverda yaratadi, takrorda -2 qo`shadi', () => {
    const store = createStore({ file, seed: SEED, logger: silentLogger() })
    const a = store.createArticle({ title: "O'zbekiston g'alabasi: 2:0!" })
    const b = store.createArticle({ title: "O'zbekiston g'alabasi: 2:0!" })
    assert.equal(a.slug, 'ozbekiston-galabasi-2-0')
    assert.equal(b.slug, 'ozbekiston-galabasi-2-0-2')
    assert.equal(store.getArticle(a.slug).title, "O'zbekiston g'alabasi: 2:0!")
    assert.equal(readJson(file)[0].slug, b.slug, 'faylga yozilgan')
  })

  test('createArticle ortiqcha maydonlar bilan rad etiladi va hech narsa yozilmaydi', () => {
    const store = createStore({ file, seed: SEED, logger: silentLogger() })
    assert.throws(
      () => store.createArticle({ title: 'T', slug: 'birinchi', isAdmin: true }),
      err => err instanceof ArticleValidationError && err.code === 'BAD_REQUEST' && err.errors.length === 2,
    )
    assert.equal(store.listArticles().length, 2)
    assert.deepEqual(readJson(file), SEED)
  })

  test("updateArticle slugni o'zgartira olmaydi, faqat validatsiyadan o'tgan maydonlar yoziladi", () => {
    const store = createStore({ file, seed: SEED, logger: silentLogger() })
    assert.throws(() => store.updateArticle('birinchi', { slug: 'yangi' }), ArticleValidationError)
    const updated = store.updateArticle('birinchi', { title: 'Yangilangan' })
    assert.equal(updated.slug, 'birinchi')
    assert.equal(updated.title, 'Yangilangan')
    assert.deepEqual(updated.body, ['Matn bir'])
    assert.equal(store.updateArticle('yoq', { title: 'X' }), null)
  })

  test("deleteArticle mavjud bo'lsa true, aks holda false", () => {
    const store = createStore({ file, seed: SEED, logger: silentLogger() })
    assert.equal(store.deleteArticle('ikkinchi'), true)
    assert.equal(store.deleteArticle('ikkinchi'), false)
    assert.deepEqual(
      readJson(file).map(a => a.slug),
      ['birinchi'],
    )
  })

  test('yozish atomik: tmp fayl qolmaydi', () => {
    const store = createStore({ file, seed: SEED, logger: silentLogger() })
    store.createArticle({ title: 'Atomik' })
    assert.deepEqual(readdirSync(dir), ['news.json'])
  })

  test("yozish yiqilsa xotiradagi holat o'zgarmaydi (tranzaksiya)", () => {
    const store = createStore({ file, seed: SEED, logger: silentLogger() })
    mkdirSync(`${file}.tmp-${process.pid}`) // tmp yo'li papka — writeFileSync yiqiladi
    assert.throws(() => store.createArticle({ title: 'Yozilmaydi' }))
    assert.throws(() => store.deleteArticle('birinchi'))
    assert.equal(store.listArticles().length, 2)
    assert.ok(store.getArticle('birinchi'))
  })
})

// renameSync'ni kerakli paytda N marta yiqitadigan fs o'ramasi
function flakyFs(code = 'EPERM') {
  const state = { calls: 0, failLeft: 0 }
  const renameSync = (...a) => {
    state.calls++
    if (state.failLeft > 0) {
      state.failLeft--
      throw Object.assign(new Error(code), { code })
    }
    return nodeFs.renameSync(...a)
  }
  return { state, fs: { ...nodeFs, renameSync } }
}

describe('createStore — Windows rename qayta urinish', () => {
  test('win32: vaqtinchalik EPERM dan keyin yoziladi', () => {
    const { state, fs } = flakyFs('EPERM')
    const store = createStore({ file, seed: SEED, logger: silentLogger(), fs, platform: 'win32' })
    state.calls = 0
    state.failLeft = 2
    const a = store.createArticle({ title: 'Qayta urinish' })
    assert.equal(state.calls, 3)
    assert.equal(readJson(file)[0].slug, a.slug)
  })

  test("win32: doimiy EBUSY — 1 + 3 urinish, tmp o'chiriladi, xotira o'zgarmaydi", () => {
    const { state, fs } = flakyFs('EBUSY')
    const logger = silentLogger()
    const store = createStore({ file, seed: SEED, logger, fs, platform: 'win32' })
    state.calls = 0
    state.failLeft = 99
    assert.throws(() => store.createArticle({ title: 'Yozilmaydi' }), { code: 'EBUSY' })
    assert.equal(state.calls, 4)
    assert.deepEqual(readdirSync(dir), ['news.json'], 'tmp qolmadi')
    assert.equal(logger.calls.error.length, 1)
    assert.equal(store.listArticles().length, 2)
  })

  test("win32 bo'lmasa qayta urinilmaydi", () => {
    const { state, fs } = flakyFs('EPERM')
    const store = createStore({ file, seed: SEED, logger: silentLogger(), fs, platform: 'linux' })
    state.calls = 0
    state.failLeft = 1
    assert.throws(() => store.deleteArticle('birinchi'), { code: 'EPERM' })
    assert.equal(state.calls, 1)
    assert.ok(store.getArticle('birinchi'))
  })

  test('qayta urinilmaydigan xato kodi (ENOSPC) win32 da ham darhol uzatiladi', () => {
    const { state, fs } = flakyFs('ENOSPC')
    const store = createStore({ file, seed: SEED, logger: silentLogger(), fs, platform: 'win32' })
    state.calls = 0
    state.failLeft = 1
    assert.throws(() => store.createArticle({ title: 'X' }), { code: 'ENOSPC' })
    assert.equal(state.calls, 1)
  })
})

describe("createStore — ichki holat tashqaridan o'zgarmaydi", () => {
  test("qaytarilgan obyektlarni o'zgartirish omborga ta'sir qilmaydi", () => {
    const store = createStore({ file, seed: SEED, logger: silentLogger() })
    store.getArticle('birinchi').body.push('buzildi')
    store.listArticles()[0].title = 'buzildi'
    store.searchArticles('birinchi')[0].title = 'buzildi'
    store.homeBlocks().lead.title = 'buzildi'
    const created = store.createArticle({ title: 'Yangi', tags: ['a'] })
    created.tags.push('b')
    store.updateArticle('ikkinchi', { title: 'Ikki' }).title = 'buzildi'
    assert.deepEqual(store.getArticle('birinchi').body, ['Matn bir'])
    assert.equal(store.getArticle('birinchi').title, 'Birinchi maqola')
    assert.deepEqual(store.getArticle(created.slug).tags, ['a'])
    assert.equal(store.getArticle('ikkinchi').title, 'Ikki')
  })
})

describe("createStore — buzilgan ma'lumot", () => {
  test("buzilgan JSON .corrupt-<ts> ga ko'chiriladi va seed'dan tiklanadi", () => {
    writeFileSync(file, '{ buzilgan json', 'utf8')
    const logger = silentLogger()
    const store = createStore({ file, seed: SEED, logger })
    const corrupt = readdirSync(dir).filter(n => /^news\.json\.corrupt-\d+$/.test(n))
    assert.equal(corrupt.length, 1)
    assert.equal(readFileSync(join(dir, corrupt[0]), 'utf8'), '{ buzilgan json')
    assert.deepEqual(readJson(file), SEED)
    assert.equal(store.listArticles().length, 2)
    assert.equal(logger.calls.error.length, 1)
  })

  test('massiv emas JSON ham buzilgan deb hisoblanadi', () => {
    writeFileSync(file, '{"slug":"x"}', 'utf8')
    const store = createStore({ file, seed: SEED, logger: silentLogger() })
    assert.equal(store.listArticles().length, 2)
    assert.equal(readdirSync(dir).filter(n => n.includes('.corrupt-')).length, 1)
  })

  test("slug'siz yozuvlar ogohlantirish bilan tashlab yuboriladi", () => {
    writeFileSync(file, JSON.stringify([{ slug: 'a', title: 'A' }, { title: 'slugsiz' }, null, 'matn']), 'utf8')
    const logger = silentLogger()
    const store = createStore({ file, seed: SEED, logger })
    assert.deepEqual(
      store.listArticles().map(a => a.slug),
      ['a'],
    )
    assert.equal(logger.calls.warn.length, 1)
  })

  test('searchArticles buzilgan maydonlarda yiqilmaydi', () => {
    const broken = [
      { slug: 'satr', title: 'Satr body', body: 'Messi gol urdi' },
      { slug: 'null', title: null, standfirst: 5, body: null },
      { slug: 'aralash', title: 'Aralash', body: ['Messi', 7, null] },
    ]
    writeFileSync(file, JSON.stringify(broken), 'utf8')
    const store = createStore({ file, seed: SEED, logger: silentLogger() })
    const found = store.searchArticles('messi').map(a => a.slug)
    assert.deepEqual(found, ['satr', 'aralash'])
    assert.equal(
      found.every(s => !('body' in store.searchArticles('messi').find(a => a.slug === s))),
      true,
    )
    assert.deepEqual(store.searchArticles(''), [])
    assert.deepEqual(store.searchArticles(undefined), [])
    assert.deepEqual(store.searchArticles({ q: 1 }), [])
  })
})

describe('standart eksportlar (ESCORE_DATA_DIR)', () => {
  test('modul eksportlari env papkasida ishlaydi, import faylga tegmaydi', async () => {
    process.env.ESCORE_DATA_DIR = dir
    try {
      const mod = await import('../store.js')
      assert.equal(existsSync(file), false, 'import paytida fayl yaratilmaydi')
      for (const name of ['listArticles', 'getArticle', 'createArticle', 'updateArticle', 'deleteArticle']) {
        assert.equal(typeof mod[name], 'function', name)
      }
      assert.equal(typeof mod.searchArticles, 'function')
      assert.equal(typeof mod.homeBlocks, 'function')
      const created = mod.createArticle({ title: 'Env papkada' })
      assert.equal(mod.getArticle(created.slug).title, 'Env papkada')
      assert.equal(mod.homeBlocks().lead.slug, created.slug)
      assert.ok(existsSync(file))
    } finally {
      delete process.env.ESCORE_DATA_DIR
    }
  })
})
