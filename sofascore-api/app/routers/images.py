"""Rasmlar / emblemalar / logotiplar (binary proksi).

SofaScore rasmlari to'g'ridan-to'g'ri binary qaytaradi — ularni o'z domeningizdan
uzatamiz (CORS muammosisiz frontendda ishlatish uchun)."""
from fastapi import APIRouter, Response
from .. import config
from ..sofascore import get_image

router = APIRouter(prefix="/images", tags=["Rasmlar (Images)"])


def _img_response(data: bytes, content_type: str) -> Response:
    return Response(
        content=data,
        media_type=content_type,
        headers={"Cache-Control": f"public, max-age={config.CACHE_TTL_IMAGE}"},
    )


@router.get("/team/{team_id}", summary="Jamoa logotipi/emblema")
async def team_image(team_id: int):
    data, ct = await get_image(f"/team/{team_id}/image")
    return _img_response(data, ct)


@router.get("/player/{player_id}", summary="O'yinchi rasmi")
async def player_image(player_id: int):
    data, ct = await get_image(f"/player/{player_id}/image")
    return _img_response(data, ct)


@router.get("/tournament/{tournament_id}", summary="Turnir logotipi")
async def tournament_image(tournament_id: int):
    data, ct = await get_image(f"/unique-tournament/{tournament_id}/image")
    return _img_response(data, ct)


@router.get("/manager/{manager_id}", summary="Murabbiy rasmi")
async def manager_image(manager_id: int):
    data, ct = await get_image(f"/manager/{manager_id}/image")
    return _img_response(data, ct)


@router.get("/referee/{referee_id}", summary="Sudya rasmi")
async def referee_image(referee_id: int):
    data, ct = await get_image(f"/referee/{referee_id}/image")
    return _img_response(data, ct)


@router.get("/country/{alpha2}", summary="Davlat bayrog'i (masalan: uz, gb, es)")
async def country_flag(alpha2: str):
    data, ct = await get_image(f"/static/images/flags/{alpha2.lower()}.png")
    return _img_response(data, ct)
