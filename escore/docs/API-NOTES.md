# 2-to'lqin uchun yangi API (1-to'lqin natijasi)

## src/api.js (T-06)
- Eksport: `api`, `useApi`, `ApiError`, `isAbortError(e)`, `clearApiCache()`, `resolveBase()`, `REQUEST_TIMEOUT_MS` (15000), `CACHE_TTL_MS` (30000).
- Har `api.*` metodi oxirgi argument `opts = { signal?, fresh? }`. GET 30 s keshlanadi — **polling'da albatta `{ fresh: true }`**.
- `api.archive({ q, category, page }, opts)` → `{ items, total, page, size, hasMore, categories }`.
- `api.matches({ date, status = 'all', q }, opts)`; `api.league(id, season, opts)`; `api.playerSeason(id, tid, sid, opts)`; `api.img(kind, id)` → URL | null.
- `ApiError { status, code, message }`; code: `UPSTREAM_UNAVAILABLE`, `NOT_FOUND`, `BAD_REQUEST`, `INTERNAL`, `RATE_LIMITED`, `NETWORK`, `TIMEOUT`, `BAD_RESPONSE`, `CONFIG`. Bekor qilinganda `AbortError` (`isAbortError`).
- `useApi(fn, deps)` → `{ data, error, loading, reload }`. Tavsiya: `useApi(o => api.match(id, o), [id])` (fn `{signal, fresh}` oladi). `deps` faqat primitivlar. `error` — obyekt (matn kerak bo'lsa `errorText(error)`); JSX ga to'g'ridan-to'g'ri chiqarmang.
- Keshdagi obyektlarni joyida o'zgartirmang (sort/splice o'rniga nusxa). Kesh qiymatlari sayoz `Object.freeze` — joyida `sort()` TypeError beradi: `[...arr].sort(...)`.
- Qo'shimcha: `api.bootstrap(opts)` → `{ issue, ticker }`; `Loading({ label, autoFocus })`, `ErrorBox({ ..., autoFocus })`.

## src/components/States.jsx (T-06)
- `Loading({ label })`; `ErrorBox({ error, onRetry, title, level = 2 })` (sahifa butunlay xato bo'lsa `level={1}`); `Empty({ children })`; `AsyncView({ state, children, empty, loadingText, isEmpty })` — `children` funksiya `data => ...` bo'lishi mumkin; `errorText(error)`.

## src/lib/format.js (T-06)
- `safeUrl(u)` → string | null (faqat http/https); `initials(name)`; `fmtTashkentDate(date, { weekday, year, time })`; `tashkentDateKey(date?)` → 'YYYY-MM-DD'; `TASHKENT_TZ`.

## Komponentlar (T-06)
- `Flag({ value, label })` — `label={mamlakat}` bering. `Crest` endi `aria-hidden` — yonida nom matni bo'lishi shart.

## CSS (T-05) — styles.css endi src/styles/*.css ga bo'lingan (CSS'ni 2-to'lqin YOZMAYDI)
- `.stretched-link` elementining o'ziga `position` bermang (::after qatorni qoplashi uchun); qator `.is-linkrow`.
- Score: qatordagi daqiqa katagi `.sc-status` → `.sc-row__status` ga o'tkazilsin (`.sc-status` endi jonli yangilanish/xato qatori; `.sc-status.is-error` bor).
- League/Team jadvallari: klub katagi ichini `<span className="lg-club__inner">` bilan o'rang; keng jadvallar `<div className="table-scroll" role="region" aria-label="..." tabIndex={0}>`.
- Player: `ratingColor()` inline ranglari oq matn bilan kontrastdan o'tmaydi (#e08a1e 2.68, #cdaa2e 2.24, #2e8b57 4.25) — ≥4.5:1 to'q ranglar yoki qora matn. `.pls-mtl__noopp` dagi ⚽ ga `aria-hidden`.
- Jamoa ranglari inline beriladigan joylar (`.sc-badge`, `.mp-vote__seg`, `.mp-dot`) ustidagi oq matn — rangga qarab matn rangini tanlang (yorqinlik bo'yicha qora/oq).
- Mavjud: `.share-bar`, `.share-bar__btn`, `.share-bar__label`, `.arch-more`, `.sc-row__status`, `.unavailable`, `.state--empty`, `.not-found`.

## Server javob shakli o'zgarishlari (T-01, T-03)
- `/api/home`: `issue` yo'q (u `/api/bootstrap` da); real rejimda `quote: null`; `meta.source` ('live'|'store'|'demo'), `meta.unavailable`.
- `/api/featured` → `null` bo'lishi mumkin. `/api/matches` → `{ date, matches, liveCount, partial }`.
- 503 `UPSTREAM_UNAVAILABLE`, 400 `BAD_REQUEST` holatlarini ko'rsating. `/api/leagues` (ro'yxat) olib tashlangan.
- Detal javoblarda (match/team/league/player/coach/referee) `meta.unavailable: string[]` bo'lishi mumkin — tegishli bo'limda `.unavailable` yozuvi.
- T-03 2-iteratsiyasi (TASDIQLANGAN shakl) — null → "—", uydirma to'ldirmang:
  - Match obyekti (barcha ro'yxatlar): `status` = 'sched'|'live'|'ft'|'canceled'|'postponed'|'interrupted'; `hs`/`as` hisob bo'lmasa `null` (rejadagi o'yinda vaqtni ko'rsating); `minute` faqat live'da raqam, aks holda `null`; `leagueId`/`league.id` `null` bo'lishi mumkin (Link qurmang); `time`/`date` `null` bo'lishi mumkin.
  - matchDetail: `vote` null; `venue`, `referee` null; `meta.unavailable` ⊂ ['events','stats','lineups','momentum'].
  - league: jadval qatorida `home`/`away` null; `total.{w,d,l}`, `P`, `Pts`, `GF`, `GA`, `GD`, `pos`, `id` null bo'lishi mumkin; bombardir `goals`/`assists` null; `currentSeasonId` null; `meta.unavailable` ⊂ ['standings','standings/home','standings/away','stages','matches/last','matches/next','scorers'].
  - scorers: `goals`, `id`, `teamId` null; standingsMini `pts` null; home standings `p,w,d,l,pts` null.
  - team: `leagueId` null; `meta.unavailable` ⊂ ['squad','matches/last','matches/next'].
  - player: `attrs` bo'sh, `attrs[].val` null; `strengths`/`weaknesses` []; `meta.unavailable` ⊂ ['seasons','monthly','recent','attrs','season','heatmap']. playerSeason `meta.unavailable` ⊂ ['heatmap','timeline']. playerCareer: `partial`, `failedSeasons[]`, `truncated`.
  - coach: `record.{games,w,d,l,ppg,winPct}`, `totalGames`, `totalTrophies`, `career[].{from,to,games,ppg,trophies,id}` null; `meta.unavailable` ⊂ ['matches'].
  - referee: `totals.{apps,yellow,red,pen}`, `career[0].{id,pen,avgYellow}` null; `meta.unavailable` ⊂ ['matches'].
  - news() elementlari va article: `translationComplete` (false bo'lsa "Avtomatik tarjima to'liq emas" eslatmasi).
  - rankings: `rank`, `teamId`, `points` null; noma'lum kind → 400.
  - /api/img: yaroqsiz upstream → 503, rasm yo'q → 404 (`<img onError>` fallback yetarli).
- T-03 3-iteratsiya — qo'shimcha null maydonlar (frontend "—" yoki umumiy so'z chiqaradi; "null/undefined" ko'rinmasin):
  - Match: `status` null bo'lishi mumkin (statussiz — holat yorlig'isiz), `league.name`, `home.n`, `away.n`, `home.id`, `away.id`.
  - matchDetail: `stats[].home/away/label`; lineups `players[].n`.
  - team: `info.stadium/city/coach/founded`, `league.name`; sostav `players[].age`.
  - league: `league.name`, `groups[].name`; `rankings[].name`.
  - player: `team`, `rating`, `overall`, `value`, `valueText`, `base.{number,country,age,height,foot}`, `seasonSummary.*`, `stats[].rows[][1]`; playerSeason `summary.*`; playerCareer `rows[].{mp,min,rating,cls,gc,goals,assists}`.
  - coach: `team`, `country`, `formation`, `age`; referee: `country`, `age`; news/article: `league`.
- `/api/home` va `/api/matches` da `partial` (home: `meta.partial`) — true bo'lsa qisqa eslatma.

## src/lib/nav.jsx (T-04)
- `navigate(to, { replace })`; `<Link to replace? className ...rest>` — oddiy `<a href>`; param qismini `encodeURIComponent` bilan kodlang: `` `/match/${encodeURIComponent(id)}` ``.
- `useRoute()` → `{ name, ...params }`; `parseRoute(pathname)`; `safeDecode(str)`.
- Yo'llar: `/`, `/score`, `/news`, `/archive`, `/rankings/:kind`, `/news/:slug`, `/match/:id`, `/league/:id`, `/team/:id`, `/player/:id`, `/coach/:id`, `/referee/:id`, `/article/:slug`, `/section/:name`, `/search/:q`.
- BARCHA `href="#/..."`, `window.location.hash = ...`, lokal `navigate()` nusxalari → `<Link>` / `navigate` ga o'tkazilsin (hash hozircha vaqtincha ishlaydi, lekin olib tashlanadi).

## src/lib/seo.js (T-04)
- `useSeo({ title, description, image, path, type = 'website', jsonLd, noindex })` — har sahifa bir marta; maqolada `type: 'article'` + JSON-LD `NewsArticle`; o'yinda JSON-LD `SportsEvent`. Har sahifada bitta `<h1>`.

## src/lib/hooks.js (T-04)
- `useDebounce(value, ms)`, `usePageVisible()`, `usePolling(fn, ms, { enabled })` — ustma-ust tushmaydi, sahifa yashirin bo'lsa to'xtaydi, ko'ringanda darhol chaqiradi; `fn` ref orqali (useCallback shart emas). Polling ichida `api.x(params, { fresh: true, signal })`.

## Komponentlar (T-04)
- `<Tabs tabs={[{id,label}]} value onChange idBase label className tabClassName />` (tanlangan tab `is-sel`) + `<TabPanel idBase id value>` — faqat tanlangan panel render qilinadi. Eski `{key,label}` → `{id,label}`.
- `<MatchRow match={m} />` — maydonlar: `id, status ('live'|'ft'|...), minute, hs, as, ts/time, home {n,c,id}, away {n,c,id}`. Team/Coach/Referee/League dagi `<button className="lg-match">…</button>` ni almashtiring (ota `.lg-matches`/`.lg-mday` qoladi). `matchStatusText(m)` ham eksport.
- `NotFound` (props yo'q, noindex); `ErrorBoundary` App'da allaqachon bor.
- App sahifalarga beradi: `<Score/>`, `<News/>`, `<Archive/>`, `<Rankings kind/>`, `<NewsArticle slug/>`, `<Match id/>`, `<League id/>`, `<Team id/>`, `<Player id/>`, `<Coach id/>`, `<Referee id/>`, `<Article slug/>`. Sahifalar **default export** bo'lib qolsin (React.lazy). ID o'zgarsa sahifa `key` bilan qayta yaratiladi — ichki holatni qo'lda reset qilmang.
