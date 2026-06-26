"""O'yinchilar: tafsilot, statistika, transfer tarixi va narxi, o'yinlar, atributlar."""
from fastapi import APIRouter
from .. import config
from ..sofascore import get_json

router = APIRouter(prefix="/players", tags=["O'yinchilar (Players)"])


@router.get("/{player_id}", summary="O'yinchi to'liq tafsiloti")
async def player_detail(player_id: int):
    return await get_json(f"/player/{player_id}", ttl=config.CACHE_TTL_LONG)


@router.get("/{player_id}/characteristics", summary="O'yinchi xususiyatlari (pozitsiya, ish oyog'i, ...)")
async def player_characteristics(player_id: int):
    return await get_json(f"/player/{player_id}/characteristics", ttl=config.CACHE_TTL_LONG)


@router.get("/{player_id}/attribute-overviews", summary="Atributlar (radar: hujum, mudofaa, ...)")
async def player_attributes(player_id: int):
    return await get_json(f"/player/{player_id}/attribute-overviews", ttl=config.CACHE_TTL_LONG)


@router.get("/{player_id}/transfer-history", summary="Transfer tarixi va narxlari")
async def player_transfers(player_id: int):
    return await get_json(f"/player/{player_id}/transfer-history", ttl=config.CACHE_TTL_LONG)


@router.get("/{player_id}/last-year-summary", summary="So'nggi 12 oy reytinglari")
async def player_last_year(player_id: int):
    return await get_json(f"/player/{player_id}/last-year-summary", ttl=config.CACHE_TTL_SHORT)


@router.get("/{player_id}/heatmap/{tournament_id}/{season_id}", summary="Mavsum issiqlik xaritasi")
async def player_heatmap(player_id: int, tournament_id: int, season_id: int):
    return await get_json(
        f"/player/{player_id}/unique-tournament/{tournament_id}/season/{season_id}/heatmap",
        ttl=config.CACHE_TTL_LONG,
    )


@router.get("/{player_id}/events/last", summary="O'yinchining so'nggi o'yinlari")
async def player_last_events(player_id: int, page: int = 0):
    return await get_json(f"/player/{player_id}/events/last/{page}", ttl=config.CACHE_TTL_SHORT)


@router.get("/{player_id}/events/next", summary="O'yinchining keyingi o'yinlari")
async def player_next_events(player_id: int, page: int = 0):
    return await get_json(f"/player/{player_id}/events/next/{page}", ttl=config.CACHE_TTL_SHORT)


@router.get("/{player_id}/statistics/seasons", summary="Statistika mavjud bo'lgan mavsumlar")
async def player_stat_seasons(player_id: int):
    return await get_json(f"/player/{player_id}/statistics/seasons", ttl=config.CACHE_TTL_LONG)


@router.get("/{player_id}/statistics/{tournament_id}/{season_id}", summary="Mavsumiy statistika (to'liq)")
async def player_season_stats(player_id: int, tournament_id: int, season_id: int):
    return await get_json(
        f"/player/{player_id}/unique-tournament/{tournament_id}/season/{season_id}/statistics/overall",
        ttl=config.CACHE_TTL_LONG,
    )


@router.get("/{player_id}/national-team-statistics", summary="Terma jamoa statistikasi")
async def player_national_stats(player_id: int):
    return await get_json(f"/player/{player_id}/national-team-statistics", ttl=config.CACHE_TTL_LONG)
