# eSCORE — Render'ga joylashtirish va .uz domenni ulash

> **Avtomatik deploy va push faqat ega aytganda.** Bu hujjat qo'llanma; undagi buyruqlarni ega ruxsatisiz bajarmang.

Sayt 3 qismdan iborat (`render.yaml` hammasini sozlaydi):
- **escore-api** — FastAPI (SofaScore proksisi)
- **escore-backend** — Node/Express (API, sitemap, Telegram preview sahifalari)
- **escore-web** — Vite/React statik (← DOMEN shu yerga ulanadi)

---

## 1-qadam — Kodni GitHub'ga yuklash

Git allaqachon sozlangan (faqat `escore` + `sofascore-api` + `render.yaml` + `DEPLOY.md` kuzatiladi). GitHub'da yangi **bo'sh** repozitoriya oching (masalan `escore`), so'ng (faqat ega aytganda):

```bash
git add escore sofascore-api render.yaml DEPLOY.md .gitignore
git status        # commitdan OLDIN tekshiring (quyidagi ro'yxat)
git commit -m "eSCORE: Render deploy"
git branch -M main
git remote add origin https://github.com/FOYDALANUVCHI/escore.git
git push -u origin main
```

**Commitdan oldin `git status` tekshiruvi:**
- [ ] `.env` / `.env.local` (secret) ro'yxatda **yo'q** (`.env.example` lar bo'lishi mumkin)
- [ ] `escore/server/app.js`, `escore/server/http/`, `escore/server/sofa/`, `escore/server/demo/`, `escore/server/errors.js`, `escore/src/lib/` **bor** (yangi papkalar — tushib qolsa Render build/start sinadi)
- [ ] `node_modules`, `dist`, `*.log` yo'q

> `.env`, `.env.local` va `node_modules` git'ga tushmaydi — bu normal. Namuna fayllar: `escore/.env.example`, `escore/server/.env.example`.

### Namunaviy maqolalar (ega qarori)

`escore/server/db/news.json` git'da kuzatiladi va hozir **7 ta namunaviy maqola** saqlaydi; fayl yo'q bo'lsa server uni `escore/server/demo/news.js` (`ARTICLES`) dan REAL rejimda ham yaratadi. **Deploydan oldin namunaviy maqolalarni haqiqiy tahririyat kontenti bilan almashtiring yoki o'chiring** — bu ega qarori; aks holda saytda namunaviy matn haqiqiy yangilik sifatida ko'rinadi.

---

## 2-qadam — Render'da Blueprint orqali joylashtirish

1. https://dashboard.render.com → **New +** → **Blueprint**
2. GitHub repozitoriyangizni ulang → Render `render.yaml` ni o'qiydi
3. **Apply** → 3 servis yaratiladi: `escore-api` (Python), `escore-backend` (Node), `escore-web` (statik)
4. Birinchi build ~3–6 daqiqa. Tugagach sayt: `https://escore-web.onrender.com`

> **Eslatma (bepul tarif):** servislar 15 daqiqa harakatsizlikdan keyin "uxlaydi" — birinchi ochilish ~30–50s sekin. Doim tez bo'lishi uchun `escore-api` va `escore-backend` ni $7/oy "Starter" tarifiga o'tkazing (`escore-web` statik — doim bepul va tez).

### Muhit o'zgaruvchilari

`*.onrender.com` manzillari `render.yaml` da **qo'lda** yozilgan (Render `fromService` faqat host nomini beradi). Servis nomini o'zgartirsangiz, manzillarni ham yangilang.

**escore-backend**

| O'zgaruvchi | Qiymat | Izoh |
|---|---|---|
| `NODE_ENV` | `production` | So'rov logida faqat 5xx |
| `USE_REAL` | `1` | REAL rejim. `0` — faqat lokal DEMO (production'da ishlatmang) |
| `SCORE_API` | `https://escore-api.onrender.com` | FastAPI manzili |
| `ALLOWED_ORIGINS` | `https://escore-web.onrender.com` | CORS, vergul bilan. Domen ulangach: `https://escore-web.onrender.com,https://sizningdomen.uz,https://www.sizningdomen.uz` |
| `SITE_URL` | `https://escore-web.onrender.com` | Sitemap va `/share` havolalari. Domen ulangach `https://sizningdomen.uz`. Noto'g'ri URL bo'lsa server ishga tushmaydi |
| `ADMIN_TOKEN` | Render yaratadi (`generateValue`) | Yozish endpointlari uchun, quyida |
| `SOFA_TIMEOUT_MS` | (ixtiyoriy) | Default 10000 ms, maksimal 60000 |
| `ESCORE_DATA_DIR` | (ixtiyoriy) | Faqat doimiy disk ulanganda, quyida |
| `PORT` | Render beradi | Qo'lda yozmang |
| `NODE_VERSION` | `24` | Node 24 LTS (lokal v24.16). Minimal runtime 18+; testlar Node 22 va 24 da tekshirilgan (170/170). `escore-web` da ham `24`; `escore-api` da `PYTHON_VERSION=3.12.8` |

**escore-web** (build paytida bundlega yoziladi — o'zgartirgach **qayta build** kerak; secret yozmang, brauzerga ochiq)

| O'zgaruvchi | Qiymat | Izoh |
|---|---|---|
| `VITE_API_URL` | `https://escore-backend.onrender.com` | Production'da MAJBURIY; bo'lmasa sayt "API manzili sozlanmagan" xatosini ko'rsatadi |
| `VITE_SITE_URL` | `https://escore-web.onrender.com` | canonical / og:url. Domen ulangach almashtiring |

### ADMIN_TOKEN va yozish endpointlari

- `POST/PUT/DELETE /api/news` faqat `Authorization: Bearer <ADMIN_TOKEN>` bilan ishlaydi. Token yo'q yoki 16 belgidan qisqa bo'lsa yozish butunlay o'chiq (403).
- Render tokenni o'zi yaratadi. Ko'rish: `escore-backend` → **Environment** → `ADMIN_TOKEN`. Tokenni chat, kod, log yoki hisobotga yozmang.
- O'zingiz almashtirmoqchi bo'lsangiz: `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` → dashboard'ga qo'ying → servis qayta ishga tushadi.
- Yozish endpointlariga alohida qattiq limit bor (daqiqasiga 20 so'rov / IP).

### SPA fallback va backend yo'llari (escore-web `routes`)

Sayt History API routing ishlatadi (`/news/...`, `/match/...`), shuning uchun statik saytda qayta yozish qoidalari **majburiy**. Tartib muhim — Render yuqoridan birinchi mos qoidani qo'llaydi, mavjud fayl esa har doim qoidadan ustun:

1. `/sitemap.xml` → rewrite → `https://escore-backend.onrender.com/sitemap.xml`
2. `/share/*` → rewrite → `https://escore-backend.onrender.com/share/*` (Telegram/Facebook preview: OG meta + `SITE_URL/news/<slug>` ga yo'naltirish)
3. `/*` → rewrite → `/index.html` (SPA fallback)

Render hujjati (https://render.com/docs/redirects-rewrites): *Destination* "path yoki to'liq, ochiq URL" bo'lishi mumkin; rewrite brauzerni yo'naltirmaydi, kontentni asl yo'lda beradi. Ya'ni tashqi manzilga rewrite rasmiy qo'llab-quvvatlanadi. **Deploydan keyin albatta tekshiring** (quyidagi ro'yxat). Agar tashqi rewrite ishlamasa, 1–2 qoidalarni `type: redirect` ga almashtiring (Render redirect — `301`): Telegram/Google redirectga ergashadi, faqat manzil backend domeniga o'tadi.

> `public/` da `sitemap.xml` yoki `share/` fayli bo'lmasligi kerak — aks holda qoida ishlamaydi.

### Xavfsizlik headerlari (escore-web)

`X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` va `Content-Security-Policy`. CSP faqat Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`) va backend (`connect-src https://escore-backend.onrender.com`) ga ruxsat beradi. **Backend manzili o'zgarsa, CSP `connect-src` ni ham yangilang**, aks holda sayt ma'lumot ololmaydi. Yangi tashqi skript/rasm manbasi qo'shilsa CSP ham yangilanadi.

Kesh: `/assets/*` (xeshli fayllar) — `public, max-age=31536000, immutable`; `/` va `/index.html` — `no-cache`.

### Backend faqat Render proksisi ortida

Server `trust proxy 1` bilan ishlaydi: rate limit mijoz IP sini `X-Forwarded-For` ning oxirgi proksi yozuvidan oladi. Render'da bu to'g'ri. **Serverni proksisiz to'g'ridan-to'g'ri internetga ochmang** — unda har kim `X-Forwarded-For` ni soxtalashtirib limitni aylanib o'tishi mumkin. Boshqa platformaga ko'chirilsa proksi soni (`trust proxy`) qayta ko'rib chiqiladi.

---

## 3-qadam — .uz domenni ulash (ahost)

### Render tomonida
1. `escore-web` servisi → **Settings** → **Custom Domains** → **Add Custom Domain**
2. Domeningizni kiriting: `sizningdomen.uz` (va alohida `www.sizningdomen.uz`)
3. Render kerakli DNS yozuvlarini ko'rsatadi:
   - **Apex** (`sizningdomen.uz`) uchun — **A record** (Render IP manzilini ko'rsatadi)
   - **www** uchun — **CNAME** → `escore-web.onrender.com`

### ahost (yoki .uz registrator) panelida
DNS / "DNS sozlamalari" bo'limiga kirib quyidagilarni qo'shing
(aniq qiymatlarni Render'dagi oynadan ko'chiring):

| Tur | Nomi (Host) | Qiymati |
|-----|-------------|---------|
| A | `@` | `<Render ko'rsatgan IP>` |
| CNAME | `www` | `escore-web.onrender.com` |

> Agar ahost apex uchun **A** ni qabul qilmasa, **ALIAS/ANAME** turini tanlab `escore-web.onrender.com` ga yo'naltiring.

### SSL
DNS tarqalgach (15 daqiqadan bir necha soatgacha) Render **avtomatik bepul SSL** (https) o'rnatadi.

### Domen ulangach albatta yangilang
1. `escore-backend` → `ALLOWED_ORIGINS` ga domenlarni qo'shing, `SITE_URL=https://sizningdomen.uz`
2. `escore-web` → `VITE_SITE_URL=https://sizningdomen.uz` → **qayta build** (Manual Deploy → Clear cache & deploy)
3. `escore/public/robots.txt` dagi `Sitemap: https://escore-web.onrender.com/sitemap.xml` ni `Sitemap: https://sizningdomen.uz/sitemap.xml` ga almashtiring (robots.txt standarti faqat to'liq URL ni qabul qiladi)
4. `render.yaml` dagi shu qiymatlarni ham yangilang (keyingi Blueprint sync eski qiymatni qaytarmasligi uchun)

---

## Deploydan keyingi tekshiruv ro'yxati

- [ ] `https://escore-api.onrender.com/health` → 200
- [ ] `https://escore-backend.onrender.com/api/health` → 200
- [ ] `https://escore-web.onrender.com` ochiladi; DevTools Console'da CSP xatosi yo'q
- [ ] Ichki sahifani to'g'ridan-to'g'ri ochish va yangilash (F5): `https://escore-web.onrender.com/news` — 404 emas (SPA fallback)
- [ ] `curl -I https://escore-web.onrender.com/assets/<fayl>.js` → `cache-control: public, max-age=31536000, immutable`; `curl -I https://escore-web.onrender.com/` → `no-cache`
- [ ] `curl -I https://escore-web.onrender.com/news/<slug>` → `cache-control` da `no-cache` (yoki `max-age=0`) bo'lishi kerak. SPA ichki yo'llari rewrite bilan `index.html` ni beradi, lekin header yo'l bo'yicha moslanadi va `/index.html` qoidasi bu yerga tushmasligi mumkin. Agar HTML uzoq keshlansa, yangi deploydan keyin eski `index.html` o'chirilgan eski chunk (`/assets/index-<eski xesh>.js`) ni so'raydi → oq ekran/404. Bunday bo'lsa Render dashboard'da `/*` uchun `Cache-Control: no-cache` qo'shib, `/assets/*` immutable ustun turishini tekshiring
- [ ] `https://escore-web.onrender.com/sitemap.xml` → XML, ichidagi `<loc>` manzillari `SITE_URL` bilan boshlanadi
- [ ] `https://escore-web.onrender.com/share/news/<slug>` → OG meta bor HTML; Telegram'da havolani yuborib preview (sarlavha + rasm) chiqishini tekshiring
- [ ] Rate limit: bir necha `/share/...` so'rovidan keyin `RateLimit` headerlari mantiqiy (rewrite orqali kelganda barcha foydalanuvchilar bitta IP ga tushib qolmasligi kerak — muammo bo'lsa 1–2 qoidalarni redirect ga o'tkazing)
- [ ] `ADMIN_TOKEN` siz `curl -X POST https://escore-backend.onrender.com/api/news` → 401/403
- [ ] Boshqa origindan CORS so'rovi rad etiladi (`Access-Control-Allow-Origin` yo'q)
- [ ] Graceful shutdown: qayta deploy paytida `escore-backend` loglarida `[shutdown] SIGTERM: yangi ulanishlar qabul qilinmaydi` chiqadi va servis xatosiz to'xtaydi. **Bu xatti-harakat Windows'da tekshirilmagan** (Windows SIGTERM yubormaydi) — Render'da birinchi deployda kuzating.
- [ ] DNS tayyor bo'lgach `https://sizningdomen.uz` ochiladi (yashil qulf — SSL)

---

## Eslatmalar

- **Ma'lumotlar diski vaqtinchalik.** Arxiv (`archive.json`) va tahririyat maqolalari (`news.json`) default `escore/server/db` da — Render'ning vaqtinchalik diskida, **qayta deploy yoki restartda nollanadi**. Doimiy saqlash uchun: Render **Disk** (pullik) ulab `ESCORE_DATA_DIR` ni disk papkasiga (masalan `/var/data`) yo'naltiring (`render.yaml` da izohdagi namunani yoqing), yoki ma'lumotlar bazasiga o'ting. Disk ulangan servis bitta instansiyada ishlaydi va zero-downtime deploy bo'lmaydi.
- **SofaScore manbasi haqida halol ogohlantirish.** Jonli natija va jadvallar SofaScore'ning rasmiy bo'lmagan ichki API sidan olinadi. SofaScore anti-bot himoyasi bulut IP laridan (Render ham) so'rovlarni **403 bilan bloklashi mumkin**. Bunda sayt uydirma ma'lumot ko'rsatmaydi — "Ma'lumot manbai vaqtincha ishlamayapti" yozuvi chiqadi, tahririyat maqolalari esa ishlayveradi. Blokni aylanib o'tish (proksi, profil almashtirish, challenge yechish) **qilinmaydi** — bu manba shartlariga zid. Barqaror ishlash uchun rasmiy litsenziyalangan futbol API siga (masalan **API-Football**, **Sportmonks**) o'tish tavsiya etiladi; bu alohida vazifa (adapter `escore/server/sofa/*` o'rniga).
- SofaScore `scheduled-events` endpointi 404 bersa, sayt avtomatik **jonli o'yinlar** ga o'tadi (kodda zaxira bor).
- **Yangilash va deploy faqat ega aytganda.** Render'da Auto-Deploy yoqilgan bo'lsa har `git push` avtomatik deploy qiladi — shuning uchun push ham faqat ega ruxsati bilan. Xohlasangiz servis **Settings → Auto-Deploy** ni o'chirib, deployni qo'lda (Manual Deploy) qiling.
