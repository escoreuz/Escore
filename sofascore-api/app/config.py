"""Sozlamalar (environment orqali boshqariladi)."""
import os

# SofaScore API manbasi
SOFASCORE_BASE = os.getenv("SOFASCORE_BASE", "https://api.sofascore.com/api/v1")
SOFASCORE_IMG_BASE = os.getenv("SOFASCORE_IMG_BASE", "https://api.sofascore.app/api/v1")

# Brauzerga o'xshash headerlar. SofaScore "challenge" anti-botini chetlab o'tish
# uchun ENG MUHIMI: X-Requested-With: XMLHttpRequest (XHR ko'rinishida) +
# curl_cffi TLS impersonate (pastda). Busiz endpointlar 403 "challenge" qaytaradi.
DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://www.sofascore.com",
    "Referer": "https://www.sofascore.com/",
    "X-Requested-With": "XMLHttpRequest",
}

# curl_cffi TLS barmoq izi profili (Chrome). 403 olsangiz boshqasini sinang:
# chrome120, chrome123, chrome124, chrome131 ...
IMPERSONATE = os.getenv("IMPERSONATE", "chrome124")

# HTTP sozlamalari
REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "15"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))

# Kesh TTL (sekundlarda) — ma'lumot turiga qarab
CACHE_TTL_LIVE = int(os.getenv("CACHE_TTL_LIVE", "8"))        # live skor/statistika
CACHE_TTL_SHORT = int(os.getenv("CACHE_TTL_SHORT", "60"))     # fikstura, o'yin tafsiloti
CACHE_TTL_LONG = int(os.getenv("CACHE_TTL_LONG", "3600"))     # jamoa, o'yinchi, turnir
CACHE_TTL_IMAGE = int(os.getenv("CACHE_TTL_IMAGE", "86400"))  # rasmlar

# Proksi (ixtiyoriy) — bloklansa foydali
HTTP_PROXY = os.getenv("HTTP_PROXY") or os.getenv("PROXY_URL")
