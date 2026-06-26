# eSCORE — Render'ga joylashtirish va .uz domenni ulash

Sayt 3 qismdan iborat (render.yaml hammasini avtomatik sozlaydi):
- **escore-api** — FastAPI (SofaScore proksisi)
- **escore-backend** — Node/Express
- **escore-web** — Vite/React statik (← DOMEN shu yerga ulanadi)

---

## 1-qadam — Kodni GitHub'ga yuklash

Git allaqachon sozlangan (faqat `escore` + `sofascore-api` kuzatiladi). GitHub'da yangi **bo'sh** repozitoriya oching (masalan `escore`), so'ng:

```bash
git commit -m "eSCORE: Render deploy"
git branch -M main
git remote add origin https://github.com/FOYDALANUVCHI/escore.git
git push -u origin main
```

> `.env` va `node_modules` git'ga tushmaydi — bu normal.

---

## 2-qadam — Render'da Blueprint orqali joylashtirish

1. https://dashboard.render.com → **New +** → **Blueprint**
2. GitHub repozitoriyangizni ulang → Render `render.yaml` ni avtomatik o'qiydi
3. **Apply** → 3 servis ham yaratiladi va o'zaro ulanadi:
   - `escore-api` (Python), `escore-backend` (Node), `escore-web` (statik)
   - `SCORE_API` va `VITE_API_URL` **avtomatik** to'ldiriladi (qo'lda yozish shart emas)
4. Birinchi build ~3–6 daqiqa. Tugagach `escore-web` ning manzili bo'ladi:
   `https://escore-web.onrender.com` — uni ochib sayt ishlashini tekshiring.

> **Eslatma (bepul tarif):** servislar 15 daqiqa harakatsizlikdan keyin "uxlaydi" — birinchi ochilish ~30–50s sekin bo'ladi. Doim tez bo'lishi uchun `escore-api` va `escore-backend` ni $7/oy "Starter" tarifiga o'tkazing (`escore-web` statik — doim bepul va tez).

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
DNS tarqalgach (15 daqiqadan bir necha soatgacha) Render **avtomatik bepul SSL** (https) o'rnatadi. Hech narsa qilish shart emas.

---

## Tekshirish
- `https://escore-web.onrender.com` ochiladi
- DNS tayyor bo'lgach `https://sizningdomen.uz` ochiladi (yashil qulf — SSL)

## Eslatmalar
- **Arxiv** (`db/archive.json`) Render'ning vaqtinchalik diskida — qayta deploy'da nollanadi. Doimiy saqlash kerak bo'lsa Render **Disk** (paid) yoki ma'lumotlar bazasi qo'shing.
- SofaScore `scheduled-events` endpointi 404 bersa, sayt avtomatik **jonli o'yinlar** ga o'tadi (kodda zaxira bor).
- Render'da kelajakda kodni yangilash: shunchaki `git push` — Render avtomatik qayta deploy qiladi.
