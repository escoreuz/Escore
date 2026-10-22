# eSCORE Backend

eSCORE futbol sayti uchun REST API. Express 4 + Node (ESM). Tavsiya: **Node 24 LTS** (Render `NODE_VERSION=24`, lokal v24.16).
Minimal: ishga tushirish 18+ (helmet 8, `Array#findLast`, `AbortSignal.timeout`), `--env-file` 20.6+.
Testlar Node 22 va 24 da tekshirilgan (170/170).
Shartnoma (javob shakllari, xato kodlari, validatsiya): `../docs/FIX-PLAN.md` §1–§2.

## Tuzilma

```
server/
├── index.js            kirish nuqtasi: adapter tanlash (REAL/DEMO), listen, timeoutlar, graceful shutdown (SIGTERM/SIGINT)
├── app.js              createApp(deps) — Express ilovasi; sofa/store/archive tashqaridan beriladi (testlarda mock)
├── errors.js           UpstreamError, NotFoundError, BadRequestError — server bo'ylab umumiy xatolar
├── http/
│   ├── errors.js       HttpError + markaziy error middleware (xato → { error, code } JSON)
│   ├── validate.js     ID / sana / slug / URL validatsiyasi
│   ├── security.js     helmet, CORS (ALLOWED_ORIGINS), rate limit, ADMIN_TOKEN auth, so'rov logi
│   ├── seo.js          GET /sitemap.xml, GET /share/news/:slug (OG/Twitter meta, SITE_URL)
│   └── routes/
│       ├── content.js  health, bootstrap, home, news (CRUD), search, archive, feed
│       └── score.js    matches, days, leagues, teams, players, coaches, referees, rankings, img proksi
├── sofascore.js        SofaScore adapteri (façade) — REAL rejim
├── sofa/               adapter ichki modullari: http (timeout, kesh, parallellik), events, match, league,
│                       team, player, people, news, image, dates, format, limiter, log
├── store.js            tahririyat maqolalari (news.json, atomik yozish, validateArticle)
├── archive.js          yangiliklar arxivi (archive.json, flush — shutdown'da)
├── translate.js        sarlavha tarjimasi (lug'at + tashqi tarjima, LRU kesh)
├── live.js             demo jonli hisob mexanizmi — FAQAT DEMO
├── demo/               demo ma'lumot va adapter (`adapter.js`, faqat `USE_REAL=0`). ISTISNO: `demo/news.js` (`ARTICLES`)
│                       REAL rejimda ham `store.js` seed'i — news.json yo'q bo'lsa shu namunaviy maqolalar bilan yaratiladi
├── db/                 news.json / archive.json (default papka, `ESCORE_DATA_DIR` bilan almashtiriladi).
│                       news.json git'da kuzatiladi va hozir 7 ta NAMUNAVIY maqola saqlaydi — deploydan oldin ega qarori
│                       bilan haqiqiy tahririyat kontentiga almashtiriladi yoki tozalanadi (`../../DEPLOY.md`)
└── test/               node:test testlari
```

Bog'liqlik yo'nalishi: `index.js → app.js → http/** → (sofa adapter | store | archive)`. Marshrutlar yupqa;
upstream bilan ishlash `sofa/**` da, fayl saqlash `store.js`/`archive.js` da.

## Ishga tushirish

```bash
cd escore/server
npm install
cp .env.example .env            # qiymatlarni to'ldiring (secret git'ga tushmaydi)
node --env-file=.env index.js   # yoki: npm start (env shell'dan), npm run dev (--watch)
```

- REAL rejim (default) uchun FastAPI (`sofascore-api`) `SCORE_API` manzilida ishlab turishi kerak.
- FastAPI'siz lokal ishlab chiqish: `USE_REAL=0` — DEMO rejim (uydirma ma'lumot, faqat lokal).
- Frontend backendni `VITE_API_URL` dan oladi (dev default `http://localhost:4500`). `escore/` ildizidan ikki terminal:

```bash
npm run server     # backend  :4500
npm run dev        # frontend :5190
```

## Muhit o'zgaruvchilari

To'liq izohli namuna: `.env.example`.

| O'zgaruvchi | Default | Ishlatilishi |
|---|---|---|
| `PORT` | `4500` | `index.js` |
| `NODE_ENV` | — | `production` bo'lsa so'rov logida faqat 5xx (`app.js`) |
| `USE_REAL` | REAL | `0` — DEMO rejim (`index.js`) |
| `SCORE_API` | `http://localhost:8000` | FastAPI manzili (`sofa/http.js`) |
| `SOFA_TIMEOUT_MS` | `10000` | upstream timeout, 1..60000 (`sofa/http.js`) |
| `ALLOWED_ORIGINS` | `http://localhost:5190` | CORS, vergul bilan (`http/security.js`) |
| `SITE_URL` | `http://localhost:5190` | sitemap/share havolalari; http(s) bo'lmasa ishga tushmaydi (`http/security.js`) |
| `ADMIN_TOKEN` | — | yozish endpointlari; yo'q yoki < 16 belgi → yozish o'chiq (`http/routes/content.js`) |
| `ESCORE_DATA_DIR` | `server/db` | news.json / archive.json papkasi (`store.js`, `archive.js`) |

## Endpointlar

Xato javobi: `{ error, code }` — `BAD_REQUEST` 400, `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404,
`RATE_LIMITED` 429, `UPSTREAM_UNAVAILABLE` 503, `INTERNAL` 500. REAL rejimda upstream xatosi demo ma'lumot bilan yashirilmaydi.

| Metod | Yo'l | Tavsif |
|---|---|---|
| GET | `/api/health` | holat |
| GET | `/api/bootstrap` · `/api/home` · `/api/days` | gazeta sarlavhasi/ticker, bosh sahifa bloklari, kunlar (Asia/Tashkent) |
| GET | `/api/news` · `/api/news/:slug` | tahririyat maqolalari |
| POST · PUT · DELETE | `/api/news` · `/api/news/:slug` | yozish — `Authorization: Bearer <ADMIN_TOKEN>` |
| GET | `/api/search?q=` · `/api/archive?q&category&page` | qidiruv, arxiv |
| GET | `/api/feed` · `/api/feed/:slug` | tashqi yangiliklar lentasi |
| GET | `/api/matches?date&status&q` · `/api/matches/:id` · `/api/featured` | o'yinlar |
| GET | `/api/leagues/:id` · `/api/countries` · `/api/countries/:id/leagues` | ligalar |
| GET | `/api/teams/:id` · `/api/players/:id` (`/career`, `/season`) · `/api/coaches/:id` · `/api/referees/:id` | shaxs/jamoa sahifalari |
| GET | `/api/scorers` · `/api/standings-mini` · `/api/rankings/:kind` | reytinglar, yon panel |
| GET | `/api/img/:kind/:id` | rasm proksi (faqat `image/*`) |
| GET | `/sitemap.xml` · `/share/news/:slug` | SEO: sitemap, Telegram/Facebook preview sahifasi |

Barcha `/api/*` javoblarida `X-Robots-Tag: noindex`. Limitlar (daqiqasiga, IP bo'yicha, xotirada): API 300, yozish 20, SEO 60.
IP `trust proxy 1` orqali olinadi — server faqat proksi (Render) ortida ochiq bo'lishi kerak (`../../DEPLOY.md`).

## Testlar

```bash
cd escore/server && npm test          # node --test "test/*.test.js"
cd escore && npm run test:server      # xuddi shu, ildizdan
```

Lint va format (ildizdan): `npm run lint`, `npm run format:check`.

## Deploy

Render `escore-backend` servisi (`rootDir: escore/server`, `healthCheckPath: /api/health`). Server faqat o'z
papkasidan import qiladi (`../src` ga bog'liqlik yo'q). Qo'llanma: `../../DEPLOY.md`, konfiguratsiya: `../../render.yaml`.
