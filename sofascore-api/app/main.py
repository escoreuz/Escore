"""SofaScore -> o'z API'ngiz.

Ishga tushirish:
    uvicorn app.main:app --reload --port 8000

Hujjat (Swagger): http://localhost:8000/docs
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from . import cache
from .sofascore import close_client
from .routers import events, teams, players, tournaments, misc, images


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_client()


app = FastAPI(
    title="Football Data API (SofaScore)",
    description=(
        "SofaScore ma'lumotlarini yig'ib, toza REST API ko'rinishida beradi.\n\n"
        "Live skor, statistika, lineup, gollar/kartochkalar, H2H, transfer narxlari, "
        "o'yinchi/jamoa/turnir, sudya, murabbiy, stadion, rasmlar va yangiliklar."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Frontend (escore sayti va h.k.) chaqira olishi uchun CORS ochiq
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(events.router)
app.include_router(teams.router)
app.include_router(players.router)
app.include_router(tournaments.router)
app.include_router(misc.router)
app.include_router(images.router)


@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse("/docs")


@app.get("/health", tags=["Tizim"], summary="Holat tekshiruvi")
async def health():
    return {"status": "ok", "cache": cache.stats()}


@app.post("/cache/clear", tags=["Tizim"], summary="Keshni tozalash")
async def cache_clear():
    return {"cleared": cache.clear()}
