"""O'yinlar (events): live, fikstura, natijalar, tafsilot, statistika,
lineup, gollar/kartochkalar, H2H, live text, momentum, eng yaxshi o'yinchilar."""
from fastapi import APIRouter, Query
from .. import config
from ..sofascore import get_json

router = APIRouter(prefix="/events", tags=["O'yinlar (Events)"])


@router.get("/live", summary="Hozir o'ynalayotgan barcha o'yinlar")
async def live_events():
    return await get_json("/sport/football/events/live", ttl=config.CACHE_TTL_LIVE)


@router.get("/date/{date}", summary="Sana bo'yicha o'yinlar (YYYY-MM-DD)")
async def events_by_date(date: str):
    # SofaScore: scheduled-events/{YYYY-MM-DD}
    return await get_json(f"/sport/football/scheduled-events/{date}", ttl=config.CACHE_TTL_SHORT)


@router.get("/{event_id}", summary="O'yin to'liq tafsiloti")
async def event_detail(event_id: int):
    return await get_json(f"/event/{event_id}", ttl=config.CACHE_TTL_LIVE)


@router.get("/{event_id}/statistics", summary="O'yin statistikasi (zarbalar, possession, ...)")
async def event_statistics(event_id: int):
    return await get_json(f"/event/{event_id}/statistics", ttl=config.CACHE_TTL_LIVE)


@router.get("/{event_id}/lineups", summary="Tarkiblar (lineup) va formatsiya")
async def event_lineups(event_id: int):
    return await get_json(f"/event/{event_id}/lineups", ttl=config.CACHE_TTL_SHORT)


@router.get("/{event_id}/incidents", summary="Voqealar: gollar, kartochkalar, almashtirishlar")
async def event_incidents(event_id: int):
    return await get_json(f"/event/{event_id}/incidents", ttl=config.CACHE_TTL_LIVE)


@router.get("/{event_id}/graph", summary="Bosim grafigi (momentum)")
async def event_graph(event_id: int):
    return await get_json(f"/event/{event_id}/graph", ttl=config.CACHE_TTL_LIVE)


@router.get("/{event_id}/comments", summary="Live text translyatsiya (commentary)")
async def event_comments(event_id: int):
    return await get_json(f"/event/{event_id}/comments", ttl=config.CACHE_TTL_LIVE)


@router.get("/{event_id}/best-players", summary="O'yindagi eng yaxshi o'yinchilar")
async def event_best_players(event_id: int):
    return await get_json(f"/event/{event_id}/best-players", ttl=config.CACHE_TTL_SHORT)


@router.get("/{event_id}/h2h", summary="Ikki jamoa o'rtasidagi umumiy statistika (H2H)")
async def event_h2h(event_id: int):
    return await get_json(f"/event/{event_id}/h2h", ttl=config.CACHE_TTL_LONG)


@router.get("/{event_id}/h2h/events", summary="Ikki jamoaning o'zaro o'yinlari ro'yxati")
async def event_h2h_events(event_id: int):
    return await get_json(f"/event/{event_id}/h2h/events", ttl=config.CACHE_TTL_LONG)


@router.get("/{event_id}/player/{player_id}/statistics", summary="O'yindagi bitta o'yinchi statistikasi")
async def event_player_stats(event_id: int, player_id: int):
    return await get_json(f"/event/{event_id}/player/{player_id}/statistics", ttl=config.CACHE_TTL_LIVE)


@router.get("/{event_id}/managers", summary="O'yindagi murabbiylar")
async def event_managers(event_id: int):
    return await get_json(f"/event/{event_id}/managers", ttl=config.CACHE_TTL_SHORT)


@router.get("/{event_id}/odds", summary="Koeffitsientlar (mavjud bo'lsa)")
async def event_odds(event_id: int):
    return await get_json(f"/event/{event_id}/odds/1/all", ttl=config.CACHE_TTL_SHORT)
