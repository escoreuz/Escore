# ⚽ Football Data API (SofaScore)

SofaScore ma'lumotlarini yig'ib, **o'zingizning toza REST API**'ngiz ko'rinishida
beradigan dastur. Live skor, statistika, tarkiblar, gollar/kartochkalar, H2H,
transfer narxlari, o'yinchi/jamoa/turnir, sudya, murabbiy, stadion, rasmlar va
yangiliklar — hammasi bitta API'da.

> ⚠️ **Eslatma:** SofaScore'ning rasmiy ochiq API'si yo'q. Bu dastur ularning
> ichki (yashirin) API'siga murojaat qiladi. Faqat shaxsiy/o'quv maqsadida
> ishlating; SofaScore foydalanish shartlariga rioya qiling. Yuqori yuk uchun
> rasmiy litsenziyalangan provayder (masalan, Sportmonks, API-Football) tavsiya
> etiladi.

## 🚀 Ishga tushirish

```bash
cd sofascore-api
python -m venv .venv
.venv\Scripts\activate          # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Keyin brauzerda oching:

- **Swagger hujjat (interaktiv):** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **Holat:** http://localhost:8000/health

## 🔑 Anti-bot haqida (muhim)

SofaScore endpointlari `403 {"reason":"challenge"}` anti-bot bilan himoyalangan.
Oddiy `requests`/`httpx` ishlamaydi. Shu sabab dastur **`curl_cffi`** ishlatadi
(Chrome'ning TLS barmoq izini taqlid qiladi) va `X-Requested-With: XMLHttpRequest`
headerini yuboradi. Agar baribir 403 kelsa:

1. `.env` da `IMPERSONATE` ni almashtiring (`chrome120`, `chrome131`, ...).
2. `PROXY_URL` orqali proksi qo'ying (rezidensial proksi eng yaxshisi).

## 📚 Asosiy endpointlar

### O'yinlar (live, natija, kalendar)
| Endpoint | Tavsif |
|---|---|
| `GET /events/live` | Hozir o'ynalayotgan barcha o'yinlar |
| `GET /events/date/{YYYY-MM-DD}` | Sana bo'yicha o'yinlar |
| `GET /events/{id}` | O'yin to'liq tafsiloti (live skor, status) |
| `GET /events/{id}/statistics` | Statistika (zarba, possession, ...) |
| `GET /events/{id}/lineups` | Tarkiblar va formatsiya |
| `GET /events/{id}/incidents` | Gollar, kartochkalar, almashtirishlar |
| `GET /events/{id}/comments` | Live text translyatsiya |
| `GET /events/{id}/graph` | Bosim grafigi (momentum) |
| `GET /events/{id}/h2h` | O'zaro statistika |
| `GET /events/{id}/h2h/events` | O'zaro o'yinlar tarixi |
| `GET /events/{id}/best-players` | Eng yaxshi o'yinchilar |
| `GET /events/{id}/managers` | Murabbiylar |

### Jamoalar
`/teams/{id}` · `/teams/{id}/players` · `/teams/{id}/events/last` ·
`/teams/{id}/events/next` · `/teams/{id}/transfers` · `/teams/{id}/squad-market-value`

### O'yinchilar
`/players/{id}` · `/players/{id}/attribute-overviews` ·
`/players/{id}/transfer-history` · `/players/{id}/statistics/{tournamentId}/{seasonId}`

### Turnirlar / ligalar
`/tournaments/{id}` · `/tournaments/{id}/seasons` ·
`/tournaments/{id}/season/{seasonId}/standings` ·
`/tournaments/{id}/season/{seasonId}/top-players/overall`

### Boshqalar
`/referees/{id}` · `/managers/{id}` · `/venues/{id}` · `/search?q=...`

### Rasmlar (binary proksi — CORS muammosisiz frontend uchun)
`/images/team/{id}` · `/images/player/{id}` · `/images/tournament/{id}` ·
`/images/manager/{id}` · `/images/referee/{id}` · `/images/country/{alpha2}`

## 💡 ID larni qanday topish

ID larni bilmasangiz, qidiruvdan boshlang:

```
GET /search?q=barcelona      → jamoa/o'yinchi/turnir id lari
GET /search/teams?q=real
GET /search/players?q=messi
```

Mashhur ID lar: Premier League turniri = `17`, La Liga = `8`,
Champions League = `7`, Haaland = `839956`.

## ⚙️ Sozlamalar

`.env.example` ni `.env` ga nusxalang. Asosiylari:

- `IMPERSONATE` — TLS profili (default `chrome124`)
- `CACHE_TTL_LIVE` — live ma'lumot keshi (default 8s)
- `PROXY_URL` — bloklansa proksi

## 🏗️ Arxitektura

```
app/
  main.py          FastAPI ilova + CORS + routerlar
  config.py        Sozlamalar (env)
  cache.py         Xotira ichidagi TTL kesh (live=8s, statik=1soat)
  sofascore.py     curl_cffi klient (anti-bot, retry, kesh)
  routers/
    events.py      O'yinlar (live, statistika, H2H, incidents, comments)
    teams.py       Jamoalar
    players.py     O'yinchilar (transfer narxi, statistika)
    tournaments.py Turnirlar (jadval, top o'yinchilar)
    misc.py        Sudya, murabbiy, stadion, qidiruv, media
    images.py      Rasmlar (binary proksi)
```

Har bir so'rov keshlanadi — bir xil so'rov TTL ichida SofaScore'ga qayta
bormaydi (ularning serverini ortiqcha yuklamaslik uchun).
