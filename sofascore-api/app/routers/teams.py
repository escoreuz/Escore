"""Jamoalar: tafsilot, o'yinchilar, o'yinlar (o'tgan/kelajak), transferlar, statistika."""
from fastapi import APIRouter
from .. import config
from ..sofascore import get_json

router = APIRouter(prefix="/teams", tags=["Jamoalar (Teams)"])


@router.get("/{team_id}", summary="Jamoa to'liq tafsiloti")
async def team_detail(team_id: int):
    return await get_json(f"/team/{team_id}", ttl=config.CACHE_TTL_LONG)


@router.get("/{team_id}/players", summary="Jamoa tarkibi (o'yinchilar ro'yxati)")
async def team_players(team_id: int):
    return await get_json(f"/team/{team_id}/players", ttl=config.CACHE_TTL_LONG)


@router.get("/{team_id}/events/last", summary="O'tgan o'yinlar (natijalar)")
async def team_last_events(team_id: int, page: int = 0):
    return await get_json(f"/team/{team_id}/events/last/{page}", ttl=config.CACHE_TTL_SHORT)


@router.get("/{team_id}/events/next", summary="Kelajakdagi o'yinlar (kalendar)")
async def team_next_events(team_id: int, page: int = 0):
    return await get_json(f"/team/{team_id}/events/next/{page}", ttl=config.CACHE_TTL_SHORT)


@router.get("/{team_id}/transfers", summary="Jamoa transferlari")
async def team_transfers(team_id: int):
    return await get_json(f"/team/{team_id}/transfers", ttl=config.CACHE_TTL_LONG)


@router.get("/{team_id}/squad-market-value", summary="Tarkib bozor qiymati")
async def team_market_value(team_id: int):
    return await get_json(f"/team/{team_id}/squad-market-value", ttl=config.CACHE_TTL_LONG)


@router.get("/{team_id}/performance", summary="Jamoa so'nggi natijalari (forma)")
async def team_performance(team_id: int):
    return await get_json(f"/team/{team_id}/performance", ttl=config.CACHE_TTL_SHORT)


@router.get("/{team_id}/tournaments", summary="Jamoa qatnashayotgan turnirlar")
async def team_tournaments(team_id: int):
    return await get_json(f"/team/{team_id}/standings/seasons", ttl=config.CACHE_TTL_LONG)


@router.get("/{team_id}/statistics/{tournament_id}/{season_id}", summary="Jamoaning mavsumiy statistikasi")
async def team_season_stats(team_id: int, tournament_id: int, season_id: int):
    return await get_json(
        f"/team/{team_id}/unique-tournament/{tournament_id}/season/{season_id}/statistics/overall",
        ttl=config.CACHE_TTL_LONG,
    )
