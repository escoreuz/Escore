// translate.js testlari — fetch mock bilan (Google'ga real so'rov yuborilmaydi).
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createTranslator, splitText } from '../translate.js'

const okResponse = text => ({ ok: true, status: 200, json: async () => [[[text, 'asl']]] })
const quietLogger = () => {
  const warns = []
  return { warns, warn: msg => warns.push(msg) }
}
const decodeQ = url => decodeURIComponent(new URL(url).searchParams.get('q'))

// So'ralgan matnni "UZ:" prefiksi bilan qaytaruvchi mock; chaqiruvlarni yozib boradi
function echoFetch() {
  const calls = []
  const fetchImpl = async url => {
    const q = decodeQ(url)
    calls.push(q)
    return okResponse(`UZ:${q}`)
  }
  return { calls, fetchImpl }
}

describe('translate — kesh', () => {
  test('natija keshlanadi: ikkinchi chaqiruv fetch qilmaydi', async () => {
    const { calls, fetchImpl } = echoFetch()
    const tr = createTranslator({ fetchImpl, logger: quietLogger() })
    assert.equal(await tr.translate('  Hello world '), 'UZ:Hello world')
    assert.equal(await tr.translate('Hello world'), 'UZ:Hello world')
    assert.equal(calls.length, 1)
  })

  test('LRU: chegaradan oshganda eng kam ishlatilgani chiqariladi', async () => {
    const { calls, fetchImpl } = echoFetch()
    const tr = createTranslator({ fetchImpl, cacheSize: 2, logger: quietLogger() })
    await tr.translate('alpha')
    await tr.translate('beta')
    await tr.translate('alpha') // alpha yangilanadi → beta eng eskisi
    await tr.translate('gamma') // beta chiqariladi
    assert.equal(tr.cacheSize(), 2)
    await tr.translate('alpha')
    assert.equal(calls.length, 3, 'alpha hali keshda')
    await tr.translate('beta')
    assert.equal(calls.length, 4, 'beta qayta so`raldi')
  })

  test('standart kesh hajmi 5000 dan oshmaydi', async () => {
    const tr = createTranslator({ fetchImpl: async () => okResponse('ok'), maxQueue: 10_000, logger: quietLogger() })
    await tr.translateAll(Array.from({ length: 5010 }, (_, i) => `matn ${i}`))
    assert.equal(tr.cacheSize(), 5000)
  })
})

describe('translate — juda uzun matn', () => {
  test('4000 belgidan uzun matn keshlanmaydi, 4000 gacha keshlanadi', async () => {
    const { calls, fetchImpl } = echoFetch()
    const tr = createTranslator({ fetchImpl, logger: quietLogger() })
    const long = 'Word here. '.repeat(400).trim() // ~4400 belgi
    await tr.translate(long)
    const first = calls.length
    await tr.translate(long)
    assert.equal(calls.length, first * 2, "qayta so'raldi")
    assert.equal(tr.cacheSize(), 0)
    await tr.translate('w'.repeat(4000))
    assert.equal(tr.cacheSize(), 1)
  })
})

describe('translate — xatolar keshlanmaydi', () => {
  test('tarmoq xatosida asl matn qaytadi, keyingi chaqiruv qayta so`raydi', async () => {
    let n = 0
    const fetchImpl = async () => {
      n++
      if (n === 1) throw new Error('tarmoq yo`q')
      return okResponse('Salom')
    }
    const tr = createTranslator({ fetchImpl, logger: quietLogger() })
    assert.equal(await tr.translate('Hello'), 'Hello')
    assert.equal(tr.cacheSize(), 0)
    assert.equal(await tr.translate('Hello'), 'Salom')
    assert.equal(n, 2)
  })

  test("HTTP xatosi va bo'sh javob ham muvaffaqiyatsiz hisoblanadi", async () => {
    const responses = [
      { ok: false, status: 429, json: async () => [] },
      { ok: true, status: 200, json: async () => [[]] },
      { ok: true, status: 200, json: async () => 'kutilmagan' },
    ]
    const tr = createTranslator({ fetchImpl: async () => responses.shift(), logger: quietLogger() })
    const res = await tr.translateBatch(['one', 'two', 'three'])
    assert.deepEqual(res, { texts: ['one', 'two', 'three'], complete: false })
    assert.equal(tr.cacheSize(), 0)
  })

  test('timeout: osilib qolgan so`rov bekor qilinadi va asl matn qaytadi', async () => {
    const fetchImpl = (_url, { signal }) =>
      new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))))
    const tr = createTranslator({ fetchImpl, timeoutMs: 20, logger: quietLogger() })
    assert.deepEqual(await tr.translateBatch(['Slow']), { texts: ['Slow'], complete: false })
  })

  test('xato logi throttling bilan: ketma-ket xatolar bitta yozuv', async () => {
    const logger = quietLogger()
    const tr = createTranslator({ fetchImpl: async () => Promise.reject(new Error('down')), logger })
    await tr.translateAll(['a1', 'b2', 'c3'])
    assert.equal(logger.warns.length, 1)
    assert.match(logger.warns[0], /down/)
  })
})

describe('translateBatch', () => {
  test('hammasi tarjima bo`lsa complete=true, tartib saqlanadi', async () => {
    const { fetchImpl } = echoFetch()
    const tr = createTranslator({ fetchImpl, logger: quietLogger() })
    const res = await tr.translateBatch(['first', '', 'highlights', '2:1', null])
    assert.deepEqual(res, { texts: ['UZ:first', '', 'Sharh', '2:1', ''], complete: true })
  })

  test('birortasi tarjima bo`lmasa complete=false', async () => {
    const fetchImpl = async url => (decodeQ(url) === 'bad' ? Promise.reject(new Error('x')) : okResponse('yaxshi'))
    const tr = createTranslator({ fetchImpl, logger: quietLogger() })
    const res = await tr.translateBatch(['good', 'bad'])
    assert.deepEqual(res, { texts: ['yaxshi', 'bad'], complete: false })
  })

  test("massiv bo'lmasa bo'sh natija", async () => {
    const tr = createTranslator({ fetchImpl: async () => okResponse('x'), logger: quietLogger() })
    assert.deepEqual(await tr.translateBatch(undefined), { texts: [], complete: true })
  })
})

describe('lug`at va maxsus holatlar', () => {
  test("lug'at va raqamli matn fetch qilmaydi; prototip kalitlari lug'at emas", async () => {
    const { calls, fetchImpl } = echoFetch()
    const tr = createTranslator({ fetchImpl, logger: quietLogger() })
    assert.equal(await tr.translate('Full Highlights'), "To'liq sharh")
    assert.equal(await tr.translate('3 - 1'), '3 - 1')
    assert.equal(calls.length, 0)
    assert.equal(await tr.translate('constructor'), 'UZ:constructor')
  })
})

describe('parallellik chegarasi', () => {
  test("bir vaqtda 4 tadan ko'p so'rov yuborilmaydi", async () => {
    let active = 0
    let peak = 0
    const fetchImpl = async url => {
      active++
      peak = Math.max(peak, active)
      await new Promise(r => setTimeout(r, 5))
      active--
      return okResponse(`UZ:${decodeQ(url)}`)
    }
    const tr = createTranslator({ fetchImpl, logger: quietLogger() })
    const texts = Array.from({ length: 12 }, (_, i) => `text ${i}`)
    const res = await tr.translateBatch(texts)
    assert.equal(res.complete, true)
    assert.equal(peak, 4)
    assert.deepEqual(
      res.texts,
      texts.map(t => `UZ:${t}`),
    )
  })

  test("navbat to'lsa so'rov rad etiladi (cheksiz navbat yo'q)", async () => {
    const fetchImpl = async () => {
      await new Promise(r => setTimeout(r, 5))
      return okResponse('ok')
    }
    const tr = createTranslator({ fetchImpl, concurrency: 1, maxQueue: 1, logger: quietLogger() })
    const res = await tr.translateBatch(['a', 'b', 'c'])
    assert.equal(res.complete, false)
    assert.deepEqual(res.texts, ['ok', 'ok', 'c'])
  })
})

describe('uzun matn bo`laklarga bo`linadi', () => {
  test("splitText: har bo'lak ≤ 1500, gaplar saqlanadi", () => {
    const sentence = 'This is a sentence about football. '
    const text = sentence.repeat(100).trim() // ~3500 belgi
    const chunks = splitText(text)
    assert.ok(chunks.length >= 3)
    assert.ok(chunks.every(c => c.length <= 1500))
    assert.equal(chunks.join(' '), text)
  })

  test("bo'shliqsiz juda uzun so'z ham kesiladi", () => {
    const chunks = splitText('a'.repeat(3200))
    assert.deepEqual(
      chunks.map(c => c.length),
      [1500, 1500, 200],
    )
  })

  test('1500 belgigacha bitta bo`lak', () => {
    assert.deepEqual(splitText('x'.repeat(1500)), ['x'.repeat(1500)])
  })

  test("uzun matn bir nechta so'rov bilan tarjima qilinib birlashtiriladi", async () => {
    const { calls, fetchImpl } = echoFetch()
    const tr = createTranslator({ fetchImpl, logger: quietLogger() })
    const text = 'Short sentence here. '.repeat(150).trim()
    const out = await tr.translate(text)
    assert.ok(calls.length >= 2)
    assert.ok(calls.every(c => c.length <= 1500))
    assert.equal(out, calls.map(c => `UZ:${c}`).join(' '))
  })
})

describe('standart eksportlar', () => {
  test('translate, translateAll, translateBatch global fetch orqali ishlaydi', async t => {
    t.mock.method(globalThis, 'fetch', async url => okResponse(`UZ:${decodeQ(url)}`))
    const mod = await import('../translate.js')
    assert.equal(await mod.translate('Goal scored'), 'UZ:Goal scored')
    assert.deepEqual(await mod.translateAll(['One', 'Two']), ['UZ:One', 'UZ:Two'])
    assert.deepEqual(await mod.translateBatch(['Three']), { texts: ['UZ:Three'], complete: true })
    assert.equal(globalThis.fetch.mock.callCount(), 4)
  })
})
