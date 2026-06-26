"""SofaScore yashirin API bilan ishlovchi klient.

SofaScore endpointlari 403 "challenge" anti-bot bilan himoyalangan. Buni chetlab
o'tish uchun curl_cffi ishlatamiz (Chrome TLS barmoq izini taqlid qiladi) va
X-Requested-With: XMLHttpRequest headerini yuboramiz. Oddiy httpx/requests bilan
403 keladi.

Barcha so'rovlar shu yerdan o'tadi: retry, kesh va xatoliklarni HTTP javoblariga
aylantirish shu joyda boshqariladi.
"""
import asyncio
import re
import json
import html as _html
from curl_cffi.requests import AsyncSession
from curl_cffi.requests.exceptions import RequestException
from fastapi import HTTPException

from . import config
from .cache import cached

_NEXT_DATA_RE = re.compile(
    r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', re.S
)

_session: AsyncSession | None = None


def get_session() -> AsyncSession:
    global _session
    if _session is None:
        _session = AsyncSession(
            headers=config.DEFAULT_HEADERS,
            timeout=config.REQUEST_TIMEOUT,
            impersonate=config.IMPERSONATE,
            proxies={"https": config.HTTP_PROXY, "http": config.HTTP_PROXY} if config.HTTP_PROXY else None,
        )
    return _session


async def close_client() -> None:
    global _session
    if _session is not None:
        await _session.close()
        _session = None


async def _raw_get(url: str, params: dict | None = None):
    """Retry bilan GET. 5xx va tarmoq xatolarida qayta uriniladi."""
    session = get_session()
    last_exc: Exception | None = None

    for attempt in range(config.MAX_RETRIES):
        try:
            resp = await session.get(url, params=params)
            if resp.status_code >= 500:
                last_exc = HTTPException(resp.status_code, f"SofaScore upstream {resp.status_code}")
                await asyncio.sleep(0.4 * (attempt + 1))
                continue
            return resp
        except RequestException as e:
            last_exc = e
            await asyncio.sleep(0.4 * (attempt + 1))

    if isinstance(last_exc, HTTPException):
        raise last_exc
    raise HTTPException(502, f"SofaScore'ga ulanib bo'lmadi: {last_exc}")


async def get_json(path: str, params: dict | None = None, ttl: int = config.CACHE_TTL_SHORT) -> dict:
    """JSON endpointni keshlab oladi. 404 -> 404, qolgan xatolar -> mos kod."""
    cache_key = f"json:{path}:{params}"

    async def producer():
        resp = await _raw_get(f"{config.SOFASCORE_BASE}{path}", params)
        if resp.status_code == 404:
            raise HTTPException(404, "Ma'lumot topilmadi (SofaScore 404)")
        if resp.status_code == 403:
            raise HTTPException(403, "SofaScore so'rovni rad etdi (challenge) — IMPERSONATE profilini yoki proksini almashtiring")
        if resp.status_code != 200:
            raise HTTPException(resp.status_code, f"SofaScore xatosi: {resp.status_code}")
        try:
            return resp.json()
        except Exception:
            raise HTTPException(502, "SofaScore JSON o'qib bo'lmadi (ehtimol bloklash sahifasi)")

    return await cached(cache_key, ttl, producer)


async def get_image(path: str) -> tuple[bytes, str]:
    """Rasm (binary) qaytaradi: (bytes, content_type)."""
    cache_key = f"img:{path}"

    async def producer():
        resp = await _raw_get(f"{config.SOFASCORE_IMG_BASE}{path}")
        if resp.status_code == 404:
            raise HTTPException(404, "Rasm topilmadi")
        if resp.status_code != 200:
            raise HTTPException(resp.status_code, f"Rasm yuklab bo'lmadi: {resp.status_code}")
        content_type = resp.headers.get("content-type", "image/png")
        return (resp.content, content_type)

    return await cached(cache_key, config.CACHE_TTL_IMAGE, producer)


async def get_news() -> dict:
    """sofascore.com/news sahifasidagi tahririyat maqolalarini qaytaradi.

    Sahifa Next.js — maqolalar __NEXT_DATA__ ichidagi sections[].posts da.
    HTML olib, JSON ni ajratib, toza ro'yxat qaytaramiz."""
    cache_key = "news:editorial"

    async def producer():
        resp = await _raw_get("https://www.sofascore.com/news")
        if resp.status_code != 200:
            raise HTTPException(resp.status_code, f"Yangiliklar sahifasi: {resp.status_code}")
        m = _NEXT_DATA_RE.search(resp.text)
        if not m:
            raise HTTPException(502, "Yangiliklar ma'lumoti topilmadi (__NEXT_DATA__ yo'q)")
        data = json.loads(m.group(1))
        sections = data.get("props", {}).get("pageProps", {}).get("sections", [])
        out = []
        for sec in sections:
            sslug = sec.get("slug") or ""
            for p in sec.get("posts", []):
                out.append({
                    "id": p.get("id"),
                    "slug": p.get("slug"),
                    "title": p.get("title"),
                    "excerpt": p.get("excerpt") or "",
                    "image": p.get("imageUrl"),
                    "date": p.get("date"),
                    "section": sslug,
                    "categories": [c.get("slug") for c in p.get("categories", []) if c],
                    "url": f"https://www.sofascore.com/news/{p.get('slug')}",
                })
        return {"posts": out}

    return await cached(cache_key, config.CACHE_TTL_LONG, producer)


def _content_to_blocks(html_str: str) -> list[dict]:
    """Maqola HTML kontentini tartibli bloklarga aylantiradi (h2 -> sarlavha, p -> matn)."""
    blocks = []
    for tag, inner in re.findall(r"<(h2|p)\b[^>]*>(.*?)</\1>", html_str, re.S):
        text = re.sub(r"<[^>]+>", "", inner)         # ichki teglarni (a, b, ...) olib tashlaymiz
        text = _html.unescape(text).strip()
        if text:
            blocks.append({"type": "h" if tag == "h2" else "p", "text": text})
    return blocks


async def get_article(slug: str) -> dict:
    """Bitta yangilik maqolasi (sofascore.com/news/{slug}) — to'liq matn bilan."""
    cache_key = f"news:article:{slug}"

    async def producer():
        resp = await _raw_get(f"https://www.sofascore.com/news/{slug}")
        if resp.status_code == 404:
            raise HTTPException(404, "Maqola topilmadi")
        if resp.status_code != 200:
            raise HTTPException(resp.status_code, f"Maqola sahifasi: {resp.status_code}")
        m = _NEXT_DATA_RE.search(resp.text)
        if not m:
            raise HTTPException(502, "Maqola ma'lumoti topilmadi")
        post = json.loads(m.group(1)).get("props", {}).get("pageProps", {}).get("post")
        if not post:
            raise HTTPException(404, "Maqola topilmadi")
        return {
            "id": post.get("id"),
            "slug": post.get("slug"),
            "title": post.get("title"),
            "excerpt": post.get("excerpt") or "",
            "image": post.get("imageUrl"),
            "date": post.get("date"),
            "author": post.get("authorName") or "SofaScore",
            "categories": [c.get("slug") for c in post.get("categories", []) if c],
            "blocks": _content_to_blocks(post.get("content") or ""),
            "url": f"https://www.sofascore.com/news/{post.get('slug')}",
        }

    return await cached(cache_key, config.CACHE_TTL_LONG, producer)
