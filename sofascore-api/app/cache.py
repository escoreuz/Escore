"""Oddiy TTL kesh (xotirada). Live ma'lumot uchun qisqa, statik uchun uzoq TTL."""
import time
import asyncio
from typing import Any, Callable, Awaitable

_store: dict[str, tuple[float, Any]] = {}
_locks: dict[str, asyncio.Lock] = {}


def _get_lock(key: str) -> asyncio.Lock:
    lock = _locks.get(key)
    if lock is None:
        lock = asyncio.Lock()
        _locks[key] = lock
    return lock


async def cached(key: str, ttl: int, producer: Callable[[], Awaitable[Any]]) -> Any:
    """key bo'yicha keshdan oladi yoki producer() ni chaqirib keshlaydi."""
    now = time.monotonic()
    hit = _store.get(key)
    if hit and hit[0] > now:
        return hit[1]

    # Bir vaqtning o'zida bir xil so'rov bo'lsa, faqat bittasi tashqariga chiqsin
    async with _get_lock(key):
        hit = _store.get(key)
        now = time.monotonic()
        if hit and hit[0] > now:
            return hit[1]
        value = await producer()
        _store[key] = (now + ttl, value)
        return value


def clear() -> int:
    n = len(_store)
    _store.clear()
    return n


def stats() -> dict:
    now = time.monotonic()
    alive = sum(1 for exp, _ in _store.values() if exp > now)
    return {"entries": len(_store), "alive": alive}
