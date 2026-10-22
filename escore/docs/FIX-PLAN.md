# eSCORE — tuzatish rejasi va umumiy shartnoma (FIX-PLAN)

Branch: `escore-fix` (lokal, push/deploy YO'Q). Ko'rik natijalari: 2026-10-15 dagi 6 agent ko'rigi (R-1…R-6).
Bu hujjat barcha agentlar uchun yagona shartnoma. Fayl egaligi (owned_paths) qat'iy: boshqa agent faylini YOZMANG.
Agar boshqa egadagi faylda o'zgarish kerak bo'lsa — hisobotingizda "next_role" bandida yozing.

## 0. Umumiy qoidalar (ICEBERG)
- Kod uslubi: Prettier (`.prettierrc.json`: semi:false, singleQuote, printWidth 120). Izohlar o'zbekcha (lotin), mavjud uslubda.
- Funksiya ≤ 60 qator, fayl ≤ 400 qator (qo'lda yozilgan). Katta faylni mazmunli modullarga ajrating.
- Yutilgan exception yo'q: har `catch` log qiladi yoki xatoni yuqoriga uzatadi yoki aniq holat qaytaradi.
- Har tashqi chaqiruvda timeout. Cheksiz retry/kesh/navbat yo'q.
- Har o'zgarishga mazmunli test (odatiy + salbiy + chegaraviy). Testni o'chirish/skip qilish taqiqlangan.
- Tekshiruv buyruqlari (escore/ papkasida): `npm run lint`, `npm run format:check`, `npm run test:web`, `npm run test:server`, `npm run build`.
  Faqat o'z fayllaringiz uchun yashil bo'lishi shart; boshqalar xatosi bo'lsa hisobotda ayting.
- Yangi npm paket faqat shu hujjatda ruxsat berilgan bo'lsa.
- **SofaScore anti-bot blokini aylanib o'tish (impersonate profilini almashtirish, proksi, challenge yechish) TAQIQLANGAN.** Biz faqat manba ishlamayotganini halol ko'rsatamiz.

## 1. Asosiy tamoyil: demo ma'lumot real ma'lumotga aralashmaydi
- `USE_REAL` env: `0` bo'lsa — butun server DEMO rejimida (lokal ishlab chiqish). Aks holda REAL rejim (default).
- REAL rejimda upstream xatosi hech qachon demo/uydirma ma'lumot bilan yashirilmaydi.
- Saytning o'z maqolalari (`store` — news.json) bu tahririyat kontenti, uni ko'rsatish mumkin (demo emas).
- Uydirma ob-havo, narx, "jonli" demo o'yin, iyun-2026 sanasi — olib tashlanadi.

## 2. Server shartnomasi (S1 index.js ↔ S2 store/archive/translate ↔ S3 sofascore)

### 2.1 Xatolar
- `server/errors.js` (egasi S3) eksport qiladi:
  - `class UpstreamError extends Error { constructor(message, { status = 502, cause } = {}) }` — upstream ishlamadi/timeout (timeout → status 504).
  - `class NotFoundError extends Error {}` — resurs haqiqatan yo'q (upstream 404).
- `sofascore.js` eksport qiladigan barcha funksiyalar (nomlari va muvaffaqiyatli javob shakli O'ZGARMAYDI) xatoda shu ikki klassdan birini THROW qiladi. Jim `[]`/`null` qaytarish yo'q (faqat haqiqatan bo'sh natija bo'lsa `[]`).
- `index.js` xaritalash: `UpstreamError` → `503 { error: "Ma'lumot manbai vaqtincha ishlamayapti", code: 'UPSTREAM_UNAVAILABLE' }`;
  `NotFoundError` → `404 { error: '...topilmadi', code: 'NOT_FOUND' }`; validatsiya → `400 { error, code: 'BAD_REQUEST' }`;
  auth → `401/403 { code: 'UNAUTHORIZED' | 'FORBIDDEN' }`; boshqa → `500 { error: 'Server xatosi', code: 'INTERNAL' }` (stack logga, javobga emas).

### 2.2 Javob shakllari (frontend shunga tayanadi)
- `GET /api/matches?date&status&q` → `{ date, matches: [...], liveCount }`. Upstream xatosi → 503.
- `GET /api/featured` → match obyekt yoki `null` (200). Uydirma fallback yo'q. (Frontend endi featured'ni matches'dan o'zi hisoblaydi.)
- `GET /api/home` → `{ lead, secondary, briefs, quote, ticker, standings, results, fixtures, meta: { source: 'live'|'store'|'demo', unavailable: string[] } }`.
  Upstream ishlamasa: yangilik bloklari store maqolalaridan (`meta.source='store'`), `standings/results/fixtures` = `[]` va `meta.unavailable` ga bo'lim nomi qo'shiladi. Demo jadval/natija YO'Q.
- `GET /api/scorers`, `GET /api/standings-mini` → massiv; upstream xatosi → 503; bugun o'yin yo'q → `[]`.
- `GET /api/days` → `{ today: 'YYYY-MM-DD', days: [...] }` — sana `Asia/Tashkent` mintaqasida.
- `GET /api/bootstrap` → `{ issue: { volume, no, city }, ticker: [...] }` (weekday/date/weather/price olib tashlanadi; sanani frontend hisoblaydi).
- `GET /api/archive?q&category&page` → `{ items, total, page, size, hasMore }`.
- `GET /api/news/:slug` maqolasida `sourceUrl` faqat `http(s)` (S1 tekshiradi), `translationComplete: boolean`.
- Rasm proksi `GET /api/img/:kind/:id` — faqat `image/*`, aks holda 404.

### 2.3 Validatsiya (S1)
- Upstream ID (`/api/matches/:id`, teams, players, coaches, referees, leagues, `tid`, `sid`, `season`): `/^\d{1,10}$/` (REAL rejim). DEMO rejimda `/^[a-z0-9-]{1,40}$/i` va lug'atdan `Object.hasOwn`/`Map` bilan olish.
- `date`: `/^\d{4}-\d{2}-\d{2}$/` + haqiqiy sana. `slug`: `/^[a-z0-9-]{1,160}$/i`. `q`: ≤ 80 belgi. `kind` (img/rankings): oq ro'yxat.
- Yaroqsiz → 400.

### 2.4 Yozish endpointlari (`POST/PUT/DELETE /api/news`)
- `Authorization: Bearer <ADMIN_TOKEN>` (env). `crypto.timingSafeEqual` bilan solishtirish. `ADMIN_TOKEN` yo'q bo'lsa yozish o'chiq (403).
- Body `store.validateArticle(input)` orqali (S2): `{ ok: true, value } | { ok: false, errors: string[] }` → 400.

### 2.5 S2 store/archive/translate eksportlari
- `store.js`: mavjud eksportlar + `validateArticle(input, { partial })`. Fayl yozish atomik (tmp + rename), yuklash xatoda `.corrupt-<ts>` ga nusxa + seed. `ARTICLES` seed `./demo/news.js` dan.
- `archive.js`: mavjud eksportlar + `flush(): Promise<void>` (SIGTERM uchun). `list()` → `{ items, total, page, size, hasMore }`. `saveArticle(a)` faqat `a.translationComplete !== false` bo'lsa saqlaydi.
- `translate.js`: `translate(text): Promise<string>` (o'zgarmaydi), `translateAll(texts): Promise<string[]>` (o'zgarmaydi), YANGI `translateBatch(texts): Promise<{ texts: string[], complete: boolean }>`. LRU (≤ 5000), parallellik ≤ 4, uzun matn bo'laklarga.

### 2.6 Demo ma'lumot joyi
- Server faqat `server/demo/*.js` dan import qiladi (S1 ko'chiradi: `src/data/{coach,league,matchDetails,player,referee,team}Data.js` → `git mv`; `news.js`, `score.js` → nusxa). `src/data/news.js` va `score.js` 2-to'lqindan keyin frontendda ishlatilmasa o'chiriladi.
- Sabab: Render'da backend `rootDir: escore/server` — `../src/data` importi deployda sinadi.

### 2.7 S1 qo'shimcha
- `server/app.js` → `export function createApp(deps)`; `server/index.js` faqat listen + SIGTERM (graceful: `server.close`, `archive.flush`).
- Async handler o'rami, markaziy error middleware, `process.on('unhandledRejection'|'uncaughtException')` log.
- `helmet`, `express-rate-limit` (ruxsat berilgan paketlar), `app.disable('x-powered-by')`, `trust proxy 1`.
- CORS: `ALLOWED_ORIGINS` env (vergul bilan), default `http://localhost:5190`.
- `X-Robots-Tag: noindex` barcha `/api/*` ga. `GET /sitemap.xml` (store + arxiv maqolalari, `SITE_URL` env), `GET /share/news/:slug` — OG/Twitter meta bilan HTML va `SITE_URL/news/:slug` ga yo'naltirish (Telegram preview uchun).
- So'rov logi: production'da faqat xatolar.

## 3. Frontend shartnomasi

### 3.1 Routing: History API (hash emas)
Yo'llar (hozirgi hash yo'llarining `#` siz varianti): `/`, `/score`, `/news`, `/news/:slug`, `/archive`, `/rankings/:kind`, `/match/:id`, `/league/:id`, `/team/:id`, `/player/:id`, `/coach/:id`, `/referee/:id`, `/article/:slug`, `/section/:name`, `/search/:q`. Noma'lum yo'l → 404 sahifa.
Eski `#/...` havolalar ilova ochilganda `history.replaceState` bilan yangi yo'lga o'tkaziladi.

### 3.2 `src/lib/` (egasi F1, `format.js` dan tashqari)
- `nav.jsx`: `navigate(to, { replace })`, `<Link to className ...rest>` (oddiy `<a href={to}>`; Ctrl/Meta/Shift/o'rta tugma bosilsa brauzerga qoldiradi), `useRoute()` → `{ name, ...params }`, `parseRoute(pathname)`, `safeDecode(str)`.
  Har sahifa almashganda: scroll top, `#main` ga fokus.
- `seo.js`: `useSeo({ title, description, image, path, type = 'website', jsonLd })` — `document.title = "{title} | eSCORE"`, meta description, canonical, og:*, twitter:*, JSON-LD `<script>`. `SITE_URL = import.meta.env.VITE_SITE_URL || location.origin`.
- `hooks.js`: `useDebounce(value, ms)`, `usePageVisible()`, `usePolling(fn, ms, { enabled })` (sahifa yashirin bo'lsa to'xtaydi, ko'ringanda darhol yangilaydi).
- `format.js` (egasi F-state): `safeUrl(u) → string|null` (faqat http/https), `initials(name)`, `fmtTashkentDate(date)`.

### 3.3 Umumiy komponentlar
- F1: `ErrorBoundary.jsx`, `Tabs.jsx` (`<Tabs tabs={[{id,label}]} value onChange idBase label />` → `role=tablist` + `role=tab aria-selected aria-controls`, ←/→/Home/End; `<TabPanel idBase id value>{...}</TabPanel>` → `role=tabpanel aria-labelledby`), `MatchRow.jsx` (Team/Coach/Referee/League dagi `lg-match` qatori — klasslar o'zgarmaydi), `NotFound.jsx`.
- F-state: `States.jsx` → `Loading` (`role=status`), `ErrorBox({ error, onRetry })` (`role=alert`, `error.code==='UPSTREAM_UNAVAILABLE'` bo'lsa maxsus matn, port/ichki ma'lumot YO'Q), `Empty({ children })`, `AsyncView({ state, children, empty })`.
- `api.js` (F-state): `ApiError { status, code, message }`; timeout 15 s; JSON emasligini tekshirish; server `error` matnini xabarga olish; `useApi(fn, deps)` → `{ data, error, loading, reload }` (dep o'zgarganda eski data ko'rinmaydi, AbortController); GET uchun 30 s xotira keshi; production'da `VITE_API_URL` yo'q bo'lsa aniq xato. Ishlatilmagan `createNews/updateNews/deleteNews` olib tashlanadi.

### 3.4 CSS klass shartnomasi (egasi F-css — `src/styles.css`)
Komponentlar shu nomlarni ishlatadi, F-css ularni yozadi:
`.sr-only`, `.skip-link`, `.is-linkrow` (position:relative) + `.stretched-link` (`::after` inset:0), `.table-scroll` (overflow-x:auto, fokuslanadigan region),
`.ticker.is-paused`, `.ticker__pause`, `.state--error`, `.state__retry`, `.state--empty`, `.not-found`, `.lg-club__inner` (td ichidagi flex; `.lg-table__club` endi flex EMAS),
`.share-bar`, `.share-bar__btn`, `.arch-more`, `.sc-status` (jonli yangilanish/xato qatori), `.unavailable` (bo'lim ma'lumoti yo'q yozuvi), `#main:focus { outline: none }`.
Global: `:focus-visible` kontur, `@media (prefers-reduced-motion: reduce)`, kontrast tuzatishlari, teginish nishonlari ≥ 24px (asosiy tugmalar 44px).

### 3.5 A11y talablari (har komponent egasi o'z faylida)
- Bosiladigan `div/li/header` → ichida `<Link className="stretched-link">` + qatorga `is-linkrow`. Ichma-ich interaktiv bo'lsa (sevimli yulduz) u `position:relative; z-index:1`.
- Filtr tugmalari `aria-pressed`; tablar `Tabs` komponenti; jadvallar `<caption class="sr-only">`, `th scope`, `.table-scroll` o'ram.
- Yangilik rasmlari `alt={sarlavha}`; rasm-havola + sarlavha-havola takrori bo'lsa rasm-havolaga `tabIndex={-1} aria-hidden="true"`.
- Jonli holat matn bilan: `<span class="sr-only">Jonli, </span>`.
- Har sahifa `useSeo(...)` chaqiradi va bitta `<h1>` ga ega.

## 4. Vazifalar jadvali
| ID | To'lqin | Mas'ul agent | Reviewer | Owned paths |
|---|---|---|---|---|
| T-01 | 1 | org-backend-server | security-reviewer + org-backend-verify | server/index.js, server/app.js, server/live.js, server/demo/**, server/package.json, server/test/app.test.js, src/data/{coach,league,matchDetails,player,referee,team}Data.js (faqat git mv) |
| T-02 | 1 | org-data-transactions | org-data-verify | server/store.js, server/archive.js, server/translate.js, server/test/{store,archive,translate}.test.js |
| T-03 | 1 | org-backend-integrations | silent-failure-hunter + org-backend-verify | server/sofascore.js, server/sofa/**, server/errors.js, server/test/sofascore.test.js |
| T-04 | 1 | org-frontend-implementation | react-reviewer | src/App.jsx, src/main.jsx, src/lib/{nav.jsx,seo.js,hooks.js}, src/components/{ErrorBoundary,Tabs,MatchRow,NotFound}.jsx, src/components/layout/**, src/components/home/**, index.html, public/** , testlari |
| T-05 | 1 | org-frontend-accessibility | a11y-architect | src/styles.css |
| T-06 | 1 | org-frontend-state | react-reviewer | src/api.js, src/lib/format.js, src/components/{States,Crest,Flag}.jsx, testlari |
| T-07 | 2 | org-frontend-implementation | react-reviewer | src/components/Score.jsx, ScoreSidebar.jsx, src/components/score/** |
| T-08 | 2 | org-frontend-implementation | react-reviewer | src/components/{Match,League,Team,FormBadge}.jsx |
| T-09 | 2 | org-frontend-implementation | react-reviewer | src/components/{Player,Coach,Referee,Rankings,PersonHero}.jsx |
| T-10 | 2 | org-frontend-implementation | react-reviewer + seo-specialist | src/components/{News,NewsArticle,Article,Archive,ListPage,AdSlot}.jsx |
| T-11 | 2 | org-sre-cicd | org-sre-verify | ../render.yaml, ../DEPLOY.md, server/README.md, .env.example, server/.env.example |
| T-12 | 3 | security-reviewer, react-reviewer, code-reviewer, a11y-architect, org-qa-e2e | — | faqat o'qish |
