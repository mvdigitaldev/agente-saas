"""
Configuração Redis Cloud (TLS via rediss://)
"""
import os
import redis.asyncio as redis
from app.utils.logging import get_logger

logger = get_logger(__name__)


def get_redis_client():
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        raise RuntimeError("REDIS_URL não definida")

    logger.info("Conectando ao Redis Cloud via REDIS_URL (TLS)")

    return redis.from_url(
        redis_url,
        decode_responses=True,
    )
