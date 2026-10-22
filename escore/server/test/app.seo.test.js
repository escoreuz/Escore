// app.js SEO va xavfsizlik testlari: sitemap/share, ularning limit va keshlari, xavfsizlik sarlavhalari.
import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'

import { escapeHtml } from '../app.js'
import { UpstreamError, NotFoundError } from '../errors.js'
import { closeAll, fakeArchive, fakeSofa, start } from './app.helpers.js'

after(closeAll)

describe('SEO: sitemap va share', () => {
  test('share sahifasi XSS escape qiladi va SITE_URL ga yo`naltiradi', async () => {
    const evil = {
      slug: 'xss',
      title: '"><script>alert(1)</script>',
      excerpt: "a'b<img onerror=x>",
      image: 'javascript:alert(1)',
    }
    const { call } = await start({ archive: fakeArchive({ xss: evil }) })
    const res = await call('/share/news/xss')
    assert.equal(res.status, 200)
    const html = await res.text()
    assert.ok(!html.includes('<script>alert'))
    assert.ok(!html.includes('<img onerror'))
    assert.ok(html.includes(escapeHtml(evil.title)))
    assert.ok(!html.includes('og:image'))
    assert.ok(html.includes('content="0; url=https://escore.test/news/xss"'))
    assert.ok(html.includes('property="og:url" content="https://escore.test/news/xss"'))
  })

  test('share: topilmasa 404, yaroqsiz slug 400', async () => {
    const { call } = await start()
    assert.equal((await call('/share/news/yoq')).status, 404)
    assert.equal((await call('/share/news/a%3Cb')).status, 400)
  })

  test('sitemap.xml store va arxiv slug`larini o`z ichiga oladi', async () => {
    const { call } = await start({ archive: fakeArchive({ arx: { slug: 'arx', title: 'A' } }) })
    const res = await call('/sitemap.xml')
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type'), /application\/xml/)
    const xml = await res.text()
    assert.ok(xml.startsWith('<?xml'))
    assert.ok(xml.includes('<loc>https://escore.test/article/birinchi</loc><lastmod>2026-10-01</lastmod>'))
    assert.ok(xml.includes('<loc>https://escore.test/news/arx</loc>'))
  })
})

describe('SEO himoyasi: limit va keshlar', () => {
  test('/share va /sitemap.xml ham rate limit ostida (429)', async () => {
    const { call } = await start({ rateLimits: { seo: 2 } })
    await call('/sitemap.xml')
    await call('/share/news/yoq')
    const limited = [await call('/sitemap.xml'), await call('/share/news/yoq')]
    for (const res of limited) {
      assert.equal(res.status, 429)
      assert.equal((await res.json()).code, 'RATE_LIMITED')
    }
    assert.equal((await call('/api/health')).status, 200) // API limiti alohida
  })

  test('sitemap keshlanadi: ikkinchi so`rov archive.list ni chaqirmaydi', async () => {
    const archive = fakeArchive({ arx: { slug: 'arx', title: 'A' } })
    let listCalls = 0
    const list = archive.list
    archive.list = opts => {
      listCalls++
      return list(opts)
    }
    const { call } = await start({ archive })
    const first = await (await call('/sitemap.xml')).text()
    const second = await (await call('/sitemap.xml')).text()
    assert.equal(listCalls, 1)
    assert.equal(second, first)
  })

  test('share negativ kesh: upstream 404 slug qayta so`ralmaydi; upstream xatosi keshlanmaydi', async () => {
    let calls = 0
    const article = async slug => {
      calls++
      if (slug === 'down') throw new UpstreamError('down')
      throw new NotFoundError('yo`q')
    }
    const { call } = await start({ sofa: fakeSofa({ article }) })
    assert.equal((await call('/share/news/yoq')).status, 404)
    assert.equal((await call('/share/news/yoq')).status, 404)
    assert.equal(calls, 1)
    assert.equal((await call('/share/news/down')).status, 503)
    assert.equal((await call('/share/news/down')).status, 503)
    assert.equal(calls, 3)
  })

  test('share negativ kesh zaharlanmaydi: 404 → maqola arxivga qo`shiladi → keyingi so`rov 200', async () => {
    const articles = {}
    let calls = 0
    const article = async () => {
      calls++
      throw new NotFoundError('yo`q')
    }
    const { call } = await start({ sofa: fakeSofa({ article }), archive: fakeArchive(articles) })
    assert.equal((await call('/share/news/kech')).status, 404)
    articles.kech = { slug: 'kech', title: 'Kech saqlangan maqola' } // lenta keyinroq arxivladi
    const res = await call('/share/news/kech')
    assert.equal(res.status, 200)
    assert.ok((await res.text()).includes('Kech saqlangan maqola'))
    assert.equal(calls, 1) // arxivdan olindi, upstream qayta so'ralmadi
    delete articles.kech // arxivdan chiqsa — kesh o'chirilgani uchun upstream qayta so'raladi
    assert.equal((await call('/share/news/kech')).status, 404)
    assert.equal(calls, 2)
  })
})

describe('xavfsizlik sarlavhalari', () => {
  test('X-Robots-Tag, x-powered-by yo`q, CORS faqat ruxsatli origin', async () => {
    const { call } = await start({ env: { ALLOWED_ORIGINS: 'https://escore.test' } })
    const res = await call('/api/health', { headers: { Origin: 'https://escore.test' } })
    assert.equal(res.headers.get('x-robots-tag'), 'noindex')
    assert.equal(res.headers.get('x-powered-by'), null)
    assert.equal(res.headers.get('access-control-allow-origin'), 'https://escore.test')
    const other = await call('/api/health', { headers: { Origin: 'https://evil.test' } })
    assert.equal(other.headers.get('access-control-allow-origin'), null)
  })

  test('API rate limit oshsa → 429 RATE_LIMITED', async () => {
    const { call } = await start({ rateLimits: { api: 2 } })
    await call('/api/health')
    await call('/api/health')
    const res = await call('/api/health')
    assert.equal(res.status, 429)
    assert.equal((await res.json()).code, 'RATE_LIMITED')
  })
})
