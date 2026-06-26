"""Turnirlar / ligalar: tafsilot, mavsumlar, turnir jadvali, o'yinlar, top o'yinchilar."""
from fastapi import APIRouter
from .. import config
from ..sofascore import get_json

router = APIRouter(prefix="/tournaments", tags=["Turnirlar (Tournaments)"])


@router.get("/{tournament_id}", summary="Turnir (unique-tournament) tafsiloti")
async def tournament_detail(tournament_id: int):
    return await get_json(f"/unique-tournament/{tournament_id}", ttl=config.CACHE_TTL_LONG)


@router.get("/{tournament_id}/seasons", summary="Turnir mavsumlari ro'yxati")
async def tournament_seasons(tournament_id: int):
    return await get_json(f"/unique-tournament/{tournament_id}/seasons", ttl=config.CACHE_TTL_LONG)


@router.get("/{tournament_id}/season/{season_id}/standings", summary="Turnir jadvali (umumiy)")
async def standings_total(tournament_id: int, season_id: int):
    return await get_json(
        f"/unique-tournament/{tournament_id}/season/{season_id}/standings/total",
        ttl=config.CACHE_TTL_SHORT,
    )


@router.get("/{tournament_id}/season/{season_id}/standings/home", summary="Turnir jadvali (uy)")
async def standings_home(tournament_id: int, season_id: int):
    return await get_json(
        f"/unique-tournament/{tournament_id}/season/{season_id}/standings/home",
        ttl=config.CACHE_TTL_SHORT,
    )


@router.get("/{tournament_id}/season/{season_id}/standings/away", summary="Turnir jadvali (mehmon)")
async def standings_away(tournament_id: int, season_id: int):
    return await get_json(
        f"/unique-tournament/{tournament_id}/season/{season_id}/standings/away",
        ttl=config.CACHE_TTL_SHORT,
    )


@router.get("/{tournament_id}/season/{season_id}/events/last", summary="Mavsum o'yinlari (o'tgan)")
async def season_last_events(tournament_id: int, season_id: int, page: int = 0):
    return await get_json(
        f"/unique-tournament/{tournament_id}/season/{season_id}/events/last/{page}",
        ttl=config.CACHE_TTL_SHORT,
    )


@router.get("/{tournament_id}/season/{season_id}/events/next", summary="Mavsum o'yinlari (kelajak)")
async def season_next_events(tournament_id: int, season_id: int, page: int = 0):
    return await get_json(
        f"/unique-tournament/{tournament_id}/season/{season_id}/events/next/{page}",
        ttl=config.CACHE_TTL_SHORT,
    )


@router.get("/{tournament_id}/season/{season_id}/rounds", summary="Turlar (rounds) ro'yxati")
async def season_rounds(tournament_id: int, season_id: int):
    return await get_json(
        f"/unique-tournament/{tournament_id}/season/{season_id}/rounds",
        ttl=config.CACHE_TTL_LONG,
    )


@router.get("/{tournament_id}/season/{season_id}/top-players/{type}", summary="Top o'yinchilar (gol/assist/...)")
async def season_top_players(tournament_id: int, season_id: int, type: str = "overall"):
    return await get_json(
        f"/unique-tournament/{tournament_id}/season/{season_id}/top-players/{type}",
        ttl=config.CACHE_TTL_LONG,
    )


@router.get("/{tournament_id}/season/{season_id}/top-teams/{type}", summary="Top jamoalar")
async def season_top_teams(tournament_id: int, season_id: int, type: str = "overall"):
    return await get_json(
        f"/unique-tournament/{tournament_id}/season/{season_id}/top-teams/{type}",
        ttl=config.CACHE_TTL_LONG,
    )


@router.get("/{tournament_id}/season/{season_id}/info", summary="Mavsum umumiy ma'lumoti (top gol urgan, ...)")
async def season_info(tournament_id: int, season_id: int):
    return await get_json(
        f"/unique-tournament/{tournament_id}/season/{season_id}/info",
        ttl=config.CACHE_TTL_LONG,
    )


@router.get("/categories", summary="Davlatlar/kategoriyalar ro'yxati")
async def categories():
    return await get_json("/sport/football/categories", ttl=config.CACHE_TTL_LONG)
