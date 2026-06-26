"""Sudyalar, murabbiylar, stadionlar, qidiruv va yangiliklar."""
from fastapi import APIRouter, Query
from .. import config
from ..sofascore import get_json, get_news, get_article

router = APIRouter(tags=["Boshqa (Sudya/Murabbiy/Stadion/Qidiruv)"])


@router.get("/news", summary="Tahririyat yangiliklari (sofascore.com/news)")
async def news():
    return await get_news()


@router.get("/news/{slug}", summary="Bitta maqola (to'liq matn)")
async def news_article(slug: str):
    return await get_article(slug)


@router.get("/categories", summary="Davlatlar/kategoriyalar ro'yxati")
async def categories():
    return await get_json("/sport/football/categories", ttl=config.CACHE_TTL_LONG)


@router.get("/category/{category_id}/tournaments", summary="Davlat/kategoriya turnirlari")
async def category_tournaments(category_id: int):
    return await get_json(f"/category/{category_id}/unique-tournaments", ttl=config.CACHE_TTL_LONG)


@router.get("/rankings/{rank_type}", summary="Reyting (FIFA=2, UEFA=1)")
async def rankings(rank_type: int):
    return await get_json(f"/rankings/type/{rank_type}", ttl=config.CACHE_TTL_LONG)


# ----- Sudyalar -----
@router.get("/referees/{referee_id}", summary="Sudya tafsiloti")
async def referee_detail(referee_id: int):
    return await get_json(f"/referee/{referee_id}", ttl=config.CACHE_TTL_LONG)


@router.get("/referees/{referee_id}/events/last", summary="Sudya boshqargan o'yinlar")
async def referee_events(referee_id: int, page: int = 0):
    return await get_json(f"/referee/{referee_id}/events/last/{page}", ttl=config.CACHE_TTL_SHORT)


# ----- Murabbiylar -----
@router.get("/managers/{manager_id}", summary="Murabbiy tafsiloti")
async def manager_detail(manager_id: int):
    return await get_json(f"/manager/{manager_id}", ttl=config.CACHE_TTL_LONG)


@router.get("/managers/{manager_id}/events/last", summary="Murabbiyning so'nggi o'yinlari")
async def manager_events(manager_id: int, page: int = 0):
    return await get_json(f"/manager/{manager_id}/events/last/{page}", ttl=config.CACHE_TTL_SHORT)


# ----- Stadionlar -----
@router.get("/venues/{venue_id}", summary="Stadion tafsiloti")
async def venue_detail(venue_id: int):
    return await get_json(f"/venue/{venue_id}", ttl=config.CACHE_TTL_LONG)


# ----- Qidiruv -----
@router.get("/search", summary="Hammasi bo'yicha qidiruv (jamoa/o'yinchi/turnir/...)")
async def search_all(q: str = Query(..., min_length=1), page: int = 0):
    return await get_json(f"/search/all/{page}", params={"q": q}, ttl=config.CACHE_TTL_SHORT)


@router.get("/search/teams", summary="Jamoalar bo'yicha qidiruv")
async def search_teams(q: str = Query(..., min_length=1), page: int = 0):
    return await get_json(f"/search/teams/{page}", params={"q": q}, ttl=config.CACHE_TTL_SHORT)


@router.get("/search/players", summary="O'yinchilar bo'yicha qidiruv")
async def search_players(q: str = Query(..., min_length=1), page: int = 0):
    return await get_json(f"/search/player-team-persons/{page}", params={"q": q}, ttl=config.CACHE_TTL_SHORT)


# ----- Yangiliklar / media -----
@router.get("/events/{event_id}/media", summary="O'yin media (video/rasm/yangilik)")
async def event_media(event_id: int):
    return await get_json(f"/event/{event_id}/media", ttl=config.CACHE_TTL_SHORT)


@router.get("/teams/{team_id}/media", summary="Jamoa media/yangiliklari")
async def team_media(team_id: int):
    return await get_json(f"/team/{team_id}/media", ttl=config.CACHE_TTL_SHORT)


@router.get("/players/{player_id}/media", summary="O'yinchi media/yangiliklari")
async def player_media(player_id: int):
    return await get_json(f"/player/{player_id}/media", ttl=config.CACHE_TTL_SHORT)
