# AYSBERG pasport: eSCORE (tuzatish konveyeri)

Maqsad: 2026-10-15 ko'rigida (6 agent: React, xavfsizlik, ishonchlilik, tezlik, SEO, a11y) topilgan barcha kamchiliklarni bartaraf etish.
Stack: React 18 + Vite 6 (JSX) frontend; Node 24 + Express 4 backend (`server/`); upstream: `../sofascore-api` (FastAPI).
Tanlangan mutaxassislar: backend=[org-backend-server, org-backend-integrations, org-data-transactions], frontend=[org-frontend-implementation, org-frontend-state, org-frontend-accessibility], sre=[org-sre-cicd]; reviewerlar=[react-reviewer, security-reviewer, silent-failure-hunter, a11y-architect, org-data-verify, org-sre-verify].
Quality gate: `.ai-org/quality.json` — format/lint/tests/build passed; types = N/A (sabab faylda, ega tasdig'i kutilmoqda).
Shartnoma: `docs/FIX-PLAN.md`, 2-to'lqin API: `docs/API-NOTES.md`. Branch: `escore-fix` (lokal, commit qilinmagan; push/deploy faqat ega aytganda).

## Bosqichlar
| # | Bosqich | Holat | Dalil |
|---|---|---|---|
| 1 | Talablar | accepted | 6 ko'rik hisoboti (2026-10-15) |
| 2 | Arxitektura | accepted | docs/FIX-PLAN.md §1–3 |
| 3 | Rejalashtirish | accepted | docs/FIX-PLAN.md §4 |
| 4 | Amalga oshirish | accepted | T-01…T-11 |
| 5 | Bo'lim tekshiruvi | accepted | har vazifa mustaqil reviewer ACCEPTED |
| 6 | Mustaqil tekshiruv | accepted | security (2 tur), silent-failure (3 tur), a11y (3 tur), SRE (3 tur), AI direktor brauzer QA |
| 7 | Chiqarishga tayyorlik | blocked (ega qarorlari) | quyida "Ochiq qarorlar" |
| 8 | Hisobot | done | sessiya yakuniy hisoboti (2026-10-22) |

## Yakuniy dalil (2026-10-22)
- `py -3.14 .ai-org/quality_gate.py --root escore` → passed (format 0, lint 0, tests 0, build 0).
- Frontend: vitest 30 fayl, 387/387. Server: node:test 170/170 (Node 24 va Node 22 da).
- `npm audit`: escore 0, escore/server 0 zaiflik.
- Brauzer QA: konsol xatosiz; `/api/leagues/constructor` → 400, server tirik; uydirma featured → halol 503; 375px gorizontal skroll yo'q; 404 sahifa noindex; maqola sahifasi canonical + og:article + JSON-LD.

## Vazifalar
| ID | Mas'ul | Reviewer | Holat | Dalil |
|---|---|---|---|---|
| T-01 server yadrosi | org-backend-server | security-reviewer | accepted | 2-tur ACCEPTED; app.js 527→48 qator + http/** |
| T-02 store/archive/translate | org-data-transactions | org-data-verify | accepted | 89 test, coverage ~98% |
| T-03 SofaScore adapteri | org-backend-integrations | silent-failure-hunter | accepted | 3-tur ACCEPTED; 1199 qator → sofa/* 15 modul |
| T-04 ilova qobig'i/routing/SEO | org-frontend-implementation | react-reviewer | accepted | 2-tur ACCEPTED; App.jsx 591→87 |
| T-05 CSS a11y | org-frontend-accessibility | a11y-architect | accepted | 3-tur ACCEPTED; 2662 qator → 21 fayl |
| T-06 api/States/format/color | org-frontend-state | react-reviewer | accepted | 2-tur ACCEPTED |
| T-07 Score | org-frontend-implementation | react-reviewer | accepted | |
| T-08 Match/League/Team | org-frontend-implementation | react-reviewer | accepted | uzilishda o'chgan fayllar kontekstdan tiklandi |
| T-09 Player/Coach/Referee | org-frontend-implementation | react-reviewer | accepted | 2-tur ACCEPTED |
| T-10 News/Article/Archive | org-frontend-implementation | react-reviewer | accepted | 2-tur ACCEPTED |
| T-11 render.yaml/DEPLOY | org-sre-cicd | org-sre-verify | accepted | Node 24, SPA fallback, CSP |

## Ochiq qarorlar (ega)
1. SofaScore anti-bot 403: real ma'lumot kelmaydi; aylanib o'tish taqiqlangan. Litsenziyali API (API-Football/Sportmonks) tanlash kerak.
2. `server/db/news.json` va `server/demo/news.js` dagi 7 ta namunaviy maqola REAL rejimda tahririyat kontenti sifatida chiqadi — almashtirish yoki o'chirish.
3. Quality gate `types` = N/A tasdig'i.
4. Commit/push/deploy.
5. ESLint'ga `useApi` exhaustive-deps qoidasi — config-protection hook blokladi.
