"""
response_cache.py - Tiny in-process TTL cache for hot, anonymous GET reads.

The public live monitor polls a handful of read endpoints every few seconds
from every open spectator screen. During a 24h event the underlying tables
(especially lap_counts) grow all day, so each read costs more over time and the
aggregate CPU climbs with both table size and viewer count.

This cache collapses all identical anonymous reads within a short TTL into a
single computation per competition, which flattens CPU and memory regardless of
how many spectators are watching. It intentionally caches ONLY anonymous
requests (see app.py), so authenticated organizers/referees always get live,
uncached data and lap counting stays real-time.

The app runs as a single process (see app.py), so an in-memory store is enough
- consistent with the in-process rate limiter in authz.py.
"""

import time
import threading

_lock = threading.Lock()
# key -> (expires_at, status, content_type, body_bytes)
_store: dict[str, tuple[float, int, str, bytes]] = {}

# Safety cap so a flood of distinct keys can't grow memory without bound.
_MAX_ENTRIES = 512


def get(key: str):
    """Return (status, content_type, body) for a fresh entry, or None."""
    now = time.time()
    with _lock:
        entry = _store.get(key)
        if entry is None:
            return None
        expires_at, status, content_type, body = entry
        if expires_at < now:
            _store.pop(key, None)
            return None
        return status, content_type, body


def set(key: str, status: int, content_type: str, body: bytes, ttl: float) -> None:
    """Store a response body under key for ttl seconds."""
    if ttl <= 0:
        return
    now = time.time()
    with _lock:
        if len(_store) >= _MAX_ENTRIES:
            # Opportunistic prune of expired entries before inserting.
            for k in [k for k, v in _store.items() if v[0] < now]:
                _store.pop(k, None)
            # Still full? drop the soonest-to-expire entry to make room.
            if len(_store) >= _MAX_ENTRIES:
                oldest = min(_store, key=lambda k: _store[k][0])
                _store.pop(oldest, None)
        _store[key] = (now + ttl, status, content_type, body)


def clear() -> None:
    """Flush the cache (used by tests)."""
    with _lock:
        _store.clear()
