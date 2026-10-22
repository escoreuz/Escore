# eSCORE — o'zbek tilidagi futbol gazetasi

Klassik gazeta uslubidagi futbol sayti: jonli hisoblar, o'yin tafsilotlari, ligalar, jamoalar, o'yinchilar va yangiliklar — o'zbek tilida.

> Holat sanasi: **2026-10-22**. Bu fayl loyihaning to'liq holatini, ishga tushirish, deploy va **chala qolgan ishlar** ro'yxatini saqlaydi.

---

## 1. Qisqacha holat

| Qism | Holat |
|---|---|
| Frontend (React 18 + Vite) | Tayyor, testlangan |
| Backend (Node 24 + Express) | Tayyor, testlangan |
| Ma'lumot manbai | **API-Football (rasmiy, api-sports.io)** — Free tarif |
| Jonli hisoblar, kunlik o'yinlar, o'yin tafsiloti, tarkiblar | Real ma'lumot bilan ishlaydi |
| Liga jadvali, liga o'yinlari, bombardirlar | Free tarif 2026 mavsumini bermaydi → "Ma'lumot manbai vaqtincha ishlamayapti" |
| Yangiliklar | API'da yo'q → saytning o'z maqolalari (store) ko'rsatiladi |
| Sifat tekshiruvi (`quality_gate`) | **passed** — format, lint, testlar, build |
| Testlar | Frontend **389/389**, server **200/200** |
| Bog'liqliklar zaifligi (`npm audit`) | **0** (frontend va server) |
| Deploy | Render uchun tayyor (`render.yaml`), hali deploy qilinmagan |

---

## 2. Arxitektura

```
Brauzer ──► escore-web (Vite statik, :5190)
               │  fetch (VITE_API_URL)
               ▼
            escore-backend (Express, :4500)
               │  DATA_PROVIDER
               ├─► apisports  → https://v3.football.api-sports.io   (asosiy, rasmiy)
               ├─► sofascore  → sofascore-api (FastAPI, :8000)       (zaxira; hozir 403 bilan bloklangan)
               └─► demo       → server/demo/* (USE_REAL=0, faqat lokal)
```

- Backend barcha manbalarni **bir xil javob shakliga** keltiradi (`server/apisports.js` va `server/sofascore.js` — bir xil eksportlar). Frontend manba qaysiligini bilmaydi.
- Manba ishlamasa uydirma ma'lumot ko'rsatilmaydi: `503 UPSTREAM_UNAVAILABLE` va sahifada halol "Ma'lumot manbai vaqtincha ishlamayapti".

### Papka tuzilmasi

```
escore/
├── index.html, vite.config.js, eslint.config.js, .prettierrc.json
├── public/                 og-default.png, ikonkalar, robots.txt, site.webmanifest
├── src/
│   ├── App.jsx, main.jsx   ilova qobig'i (ErrorBoundary, lazy sahifalar, <main>, skip-link)
│   ├── api.js              API mijozi: timeout 15 s, kesh 30 s, ApiError, useApi
│   ├── lib/                nav.jsx (History routing, Link), seo.js (useSeo, JSON-LD),
│   │                       hooks.js (usePolling, useDebounce), format.js, color.js
│   ├── components/
│   │   ├── layout/         Masthead, Nav, Ticker, SettingsMenu, SearchBox, Footer, sections.js
│   │   ├── home/           bosh sahifa bloklari, bo'lim/qidiruv sahifalari
│   │   ├── score/          Score sahifasi (useMatches, DayStrip, MatchList, SideBoxes...)
│   │   ├── match/ league/ team/ player/ news/   sahifa bo'laklari
│   │   └── *.jsx           sahifalar (Score, Match, League, Team, Player, Coach, Referee,
│   │                       Rankings, News, NewsArticle, Article, Archive, NotFound...)
│   └── styles/             21 ta CSS fayli (tokens, a11y, layout, score, match...)
├── server/
│   ├── index.js            kirish: provayder tanlash, listen, graceful shutdown
│   ├── app.js              createApp(deps)
│   ├── http/               errors, validate, security (helmet/CORS/rate limit/auth), seo, routes/*
│   ├── apisports.js + apisports/   API-Football adapteri (kesh, kvota, limiter, mappers, image)
│   ├── sofascore.js + sofa/        SofaScore adapteri (zaxira)
│   ├── store.js, archive.js, translate.js   maqolalar, arxiv, tarjima
│   ├── demo/               demo ma'lumot (faqat USE_REAL=0)
│   ├── db/                 news.json (kuzatiladi), archive.json va apisports-cache.json (gitga tushmaydi)
│   └── test/               node:test testlari
├── docs/FIX-PLAN.md        arxitektura shartnomasi
├── docs/API-NOTES.md       frontend ↔ server javob shakllari
└── AYSBERG.md              vazifalar pasporti (kim nima qildi, kim tekshirdi)
sofascore-api/              FastAPI proksi (zaxira manba)
render.yaml, DEPLOY.md      Render deploy
```

### Sahifalar (URL)

`/` · `/score` · `/news` · `/news/:slug` · `/archive` · `/match/:id` · `/league/:id` · `/team/:id` · `/player/:id` · `/coach/:id` · `/referee/:id` · `/rankings/:kind` · `/article/:slug` · `/section/:name` · `/search/:q` · noma'lum yo'l → 404. Eski `#/...` havolalar avtomatik yangi URL'ga o'tadi.

---

## 3. Lokal ishga tushirish

Talab: **Node 24** (minimal 18+; testlar Node 22 va 24 da), Python 3.12 (faqat sofascore zaxirasi uchun).

1. Bog'liqliklar:
   ```bash
   cd escore && npm install && cd server && npm install
   ```
2. `escore/server/.env` yarating (namuna: `escore/server/.env.example`). **Kalitni hech qachon gitga qo'shmang.**
   ```
   DATA_PROVIDER=apisports
   APISPORTS_BASE_URL=https://v3.football.api-sports.io
   APISPORTS_KEY=<api-football kalitingiz>
   ```
3. Backend: `cd escore/server && npm start` (`.env` avtomatik o'qiladi) → http://localhost:4500
4. Frontend: `cd escore && npm run dev` → http://localhost:5190

Claude Code'da: `.claude/launch.json` dagi `escore-api` va `escore` profillari. Faqat interfeysni ko'rish uchun kalitsiz: `USE_REAL=0` (demo rejim).

### Muhim env o'zgaruvchilar (backend)

| O'zgaruvchi | Ma'nosi |
|---|---|
| `DATA_PROVIDER` | `apisports` (asosiy) yoki `sofascore` (default, zaxira) |
| `APISPORTS_KEY` | API-Football kaliti — **secret** |
| `APISPORTS_BASE_URL` | `https://v3.football.api-sports.io` |
| `USE_REAL` | `0` → demo rejim |
| `ADMIN_TOKEN` | yangilik yozish (POST/PUT/DELETE `/api/news`) uchun, ≥16 belgi |
| `ALLOWED_ORIGINS` | CORS, frontend manzillari (vergul bilan) |
| `SITE_URL` | sayt manzili (sitemap, Telegram share) |
| `ESCORE_DATA_DIR` | `db/` o'rni (ixtiyoriy) |

Frontend: `VITE_API_URL` (backend manzili), `VITE_SITE_URL` (OG teglari uchun mutlaq URL). To'liq ro'yxat: `escore/server/README.md`, `DEPLOY.md`.

---

## 4. Sifat va testlar

```bash
cd escore
npm run lint          # ESLint (--max-warnings 0)
npm run format:check  # Prettier
npm test              # vitest (frontend) + node:test (server)
npm run build
```

Yagona tekshiruv: `py -3.14 .ai-org/quality_gate.py --root escore` (konfiguratsiya: `escore/.ai-org/quality.json`).

---

## 5. API-Football kvotasi (muhim)

Free tarif: **kuniga 100 so'rov, daqiqasiga 10**. Backend buni boshqaradi:
- disk + xotira kesh (`server/db/apisports-cache.json`), server qayta ishga tushsa ham kvota yonmaydi;
- TTL: bugungi o'yinlar 10 daq (jonli bo'lsa 3 daq), o'yin tafsiloti jonli 3 daq / tugagan 7 kun, jadval 6 soat, jamoa/o'yinchi 24 soat, davlat/liga 7 kun;
- daqiqasiga ≤ 8 so'rov; kunlik qoldiq ≤ 10 bo'lsa faqat keshdan (`meta.stale: true`);
- rasmlar (`media.api-sports.io`) kvotaga kirmaydi.

Frontend 15 soniyada yangilaydi, lekin upstream'ga so'rov TTL'dan tez ketmaydi. Haqiqiy foydalanuvchilar ko'paysa 100 so'rov yetmaydi — pullik tarif kerak (7-bo'limga qarang).

---

## 6. Deploy (Render)

`render.yaml` — 3 servis: `escore-backend` (Node 24), `escore-web` (statik, SPA fallback, CSP), `escore-api` (FastAPI, zaxira). Batafsil qadamlar va deploydan keyingi tekshiruv ro'yxati: **`DEPLOY.md`**.

Render dashboard'da qo'lda kiritiladi: **`APISPORTS_KEY`** (secret). `ADMIN_TOKEN` avtomatik yaratiladi.

---

## 7. Chala qolgan ishlar va ochiq qarorlar

### A. Ega qarori kerak
1. **API-Football tarifi.** Free tarif 2026 mavsumi uchun liga jadvali, liga o'yinlari va bombardirlarni bermaydi; kunlik 100 so'rov ommaviy sayt uchun yetmaydi. Ommaga chiqishdan oldin pullik tarifga o'tish kerak.
2. **API kalitini yangilash.** Joriy kalit chatda ochiq yozilgan — ommaga chiqishdan oldin API-Football panelida regenerate qiling va yangisini faqat `.env` / Render dashboard'ga qo'ying.
3. **Namunaviy maqolalar.** `server/db/news.json` dagi 7 ta maqola to'qima (masalan "Tarixiy yakun: yangi chempion toj kiydi"). API'da yangilik yo'qligi sababli bosh sahifada aynan shular chiqadi. Haqiqiy tahririyat maqolalari bilan almashtirish yoki o'chirish kerak.
4. **`escore-api` (FastAPI) servisi** API-Football bilan keraksiz bo'lib qoldi — `render.yaml` dan olib tashlash yoki zaxira sifatida qoldirish.
5. **Domen.** Domen ulangach: `SITE_URL`, `ALLOWED_ORIGINS`, `VITE_SITE_URL`, `VITE_API_URL`, CSP `connect-src`, `robots.txt` dagi Sitemap — hammasi yangi domenga.

### B. Texnik qarz (keyingi ishlar)
6. **API-Football adapteri mustaqil ko'rigi** (xavfsizlik + jim xatolar) hali o'tkazilmagan — adapter testlari yashil (200/200), real API bilan sinalgan, lekin AYSBERG bo'yicha ikkinchi ko'z kerak.
7. **Node 22 da `server/test/apisports.test.js` osilib qoladi** (Node 24 da o'tadi; Render Node 24). Sabab taxminiy: ref qilinmagan taymer. `sofascore.test.js` dagi kabi keepalive bilan tuzatish.
8. **API'da yo'q imkoniyatlar uchun UI:** FIFA/UEFA reytingi, hakam sahifasi, o'yinchi atributlari/heatmap/oylik reyting, o'yin momentumi, jamoa ranglari — hozir "ma'lumot yo'q" holati chiqadi. Score yon panelidagi "Reytinglar" blokini va hakam havolasini apisports rejimida yashirish kerak.
9. **Liga/jamoa/o'yinchi sahifalari real ma'lumot bilan to'liq sinalmagan** (Free tarif cheklovi tufayli). Pullik tarifdan keyin brauzerda qayta tekshirish.
10. **Davlat ID'lari** API ro'yxatidagi tartib raqamiga bog'liq (API'da raqamli id yo'q) — ro'yxat o'zgarsa siljiydi.
11. **`apisports/*` modullari** `sofa/*` dagi umumiy yordamchilardan (dates, log, cache, limiter) foydalanadi — sofascore olib tashlansa umumiy `server/lib/` ga ko'chirish.
12. **Render'dagi disk vaqtinchalik:** `archive.json` va `apisports-cache.json` har deployda nollanadi (kvota qayta sarflanadi). Render Disk yoki ma'lumotlar bazasi kerak.
13. **Deploydan keyin tekshirilishi kerak** (lokal tekshirib bo'lmaydi): SIGTERM graceful shutdown (Linux), `/share/*` va `/sitemap.xml` rewrite orqali rate-limit IP'si, SPA yo'llarida `Cache-Control`, Telegram preview.
14. **Vizual regressiya testlari yo'q.** Score qatorlaridagi CSS grid xatosi faqat brauzerda topildi (2026-10-22 tuzatildi). Playwright bilan asosiy sahifalarning skrinshot testlari tavsiya etiladi.
15. **ESLint `useApi` deps qoidasi** (`react-hooks/exhaustive-deps` + `additionalHooks`) — config-protection hook blokladi, qo'lda qo'shish kerak.
16. **Quality gate `types` = N/A** (TypeScript yo'q) — egasi tasdiqlashi kerak.
17. **Masthead'dagi "XII SON · № 247"** — statik bezak raqami, haqiqiy son hisoblagichi emas.
18. **SofaScore zaxirasi** anti-bot 403 bilan bloklangan; uni aylanib o'tish rejalashtirilmagan (rasmiy API ishlatiladi).

---

## 8. Tarix (qisqacha)

- **2026-06** — eSCORE yaratildi (React + Express, SofaScore orqali real ma'lumot).
- **2026-10-15** — 6 yo'nalishda mustaqil ko'rik: 1 CRITICAL (serverni bitta so'rov bilan o'chirish), uydirma "jonli" ma'lumot, xavfsizlik, SEO (hash routing), a11y kamchiliklari.
- **2026-10-15…22** — AYSBERG konveyeri bilan T-01…T-11 vazifalar: hammasi tuzatildi, har biri mustaqil reviewer tomonidan qabul qilindi (`escore/AYSBERG.md`).
- **2026-10-22** — rasmiy API-Football ulandi (T-13), mahkamlangan ligalar API-Football ID'lariga o'tdi (T-14), real ma'lumot bilan brauzerda tekshirildi; vite 6.4.4 / vitest 4.1.12 (audit 0).
