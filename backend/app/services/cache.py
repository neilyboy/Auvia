import json
import redis.asyncio as redis
from typing import Optional, Any
from pydantic import BaseModel
from app.config import settings

_redis_client: Optional[redis.Redis] = None


def serialize_for_cache(obj: Any) -> Any:
    """Convert Pydantic models and other objects to JSON-serializable format"""
    if isinstance(obj, BaseModel):
        return obj.model_dump(mode='json')
    elif isinstance(obj, dict):
        return {k: serialize_for_cache(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [serialize_for_cache(item) for item in obj]
    return obj


async def get_redis() -> redis.Redis:
    """Get or create Redis client"""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


async def cache_get(key: str) -> Optional[Any]:
    """Get value from cache"""
    try:
        client = await get_redis()
        value = await client.get(key)
        if value:
            return json.loads(value)
        return None
    except Exception as e:
        print(f"Cache get error: {e}")
        return None


async def cache_set(key: str, value: Any, ttl: int = 300) -> bool:
    """Set value in cache with TTL (default 5 minutes)"""
    try:
        client = await get_redis()
        serializable = serialize_for_cache(value)
        await client.setex(key, ttl, json.dumps(serializable))
        return True
    except Exception as e:
        print(f"Cache set error: {e}")
        return False


async def cache_delete(key: str) -> bool:
    """Delete value from cache"""
    try:
        client = await get_redis()
        await client.delete(key)
        return True
    except Exception as e:
        print(f"Cache delete error: {e}")
        return False


async def cache_clear_pattern(pattern: str) -> int:
    """Delete all keys matching pattern"""
    try:
        client = await get_redis()
        keys = []
        async for key in client.scan_iter(match=pattern):
            keys.append(key)
        if keys:
            await client.delete(*keys)
        return len(keys)
    except Exception as e:
        print(f"Cache clear error: {e}")
        return 0
