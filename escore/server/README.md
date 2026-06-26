# eSOCRE Backend

eSOCRE futbol sayti uchun REST API. Express + Node (ESM). Frontenddagi
ma'lumot generatorlarini (`src/data/*`) qayta ishlatadi — yagona manba,
dublikat yo'q.

## Ishga tushirish

```bash
cd server
npm install
npm start          # yoki: node index.js   (port 4500)
```

Frontend uni `http://localhost:4500` da kutadi (`src/api.js` dagi BASE).
Boshqa manzil uchun: `VITE_API_URL` muhit o'zgaruvchisi.

Ikkala serverni birga ishga tushirish (ikki terminal):
```bash
npm run server     # backend  :4500   (escore/ ildizidan)
npm run dev        # frontend :5190
```

## Xususiyatlar

- **Jonli mexanizm** (`live.js`) — server har 8s jonli o'yinlar daqiqasini
  oshiradi; 90' da o'yin avtomatik "tugagan" bo'ladi.
- **Yangiliklar CRUD** (`store.js`) — `server/db/news.json` da saqlanadi
  (birinchi ishga tushishda `ARTICLES` bilan urug'lanadi).

## Endpointlar

| Metod | Yo'l | Tavsif |
|---|---|---|
| GET | `/api/health` | holat |
| GET | `/api/bootstrap` | issue, ticker, days, leagues |
| GET | `/api/home` | bosh sahifa bloklari |
| GET | `/api/news` · `/api/news/:slug` | yangiliklar ro'yxati / bittasi |
| POST | `/api/news` | yangi maqola |
| PUT | `/api/news/:slug` | tahrirlash |
| DELETE | `/api/news/:slug` | o'chirish |
| GET | `/api/search?q=` | maqola qidiruvi |
| GET | `/api/matches?date=&status=&q=&league=` | o'yinlar (jonli) |
| GET | `/api/matches/:id` | o'yin tafsiloti |
| GET | `/api/leagues` · `/api/leagues/:id` | ligalar / liga (jadval+bombardir+o'yin) |
| GET | `/api/teams/:name` | jamoa |
| GET | `/api/players/:team/:name?pos=` | o'yinchi |
| GET | `/api/coaches/:team/:name` | murabbiy |
| GET | `/api/referees/:name` | hakam |
| GET | `/api/scorers` · `/api/standings-mini` · `/api/featured` | yon panel ma'lumotlari |
