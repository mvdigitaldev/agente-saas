"""Configuração Redis Cloud (TCP + TLS)"""
import os
import redis.asyncio as redis
from app.utils.logging import get_logger

logger = get_logger(__name__)


def get_redis_client():
    """
    Cria cliente Redis conectado ao Redis Cloud (TCP + TLS)
    
    Variáveis de ambiente necessárias:
    - REDIS_HOST: host do Redis Cloud
    - REDIS_PORT: porta (padrão: 6379)
    - REDIS_PASSWORD: senha
    - REDIS_USERNAME: username (padrão: "default")
    """
    host = os.getenv("REDIS_HOST")
    port = int(os.getenv("REDIS_PORT", "6379"))
    password = os.getenv("REDIS_PASSWORD")
    username = os.getenv("REDIS_USERNAME", "default")
    
    if not host:
        raise RuntimeError("REDIS_HOST não definida")
    if not password:
        raise RuntimeError("REDIS_PASSWORD não definida")
    
    logger.info(f"Conectando ao Redis Cloud: {host}:{port} (TLS)")
    
    return redis.Redis(
        host=host,
        port=port,
        username=username,
        password=password,
        ssl=True,
        decode_responses=True,
    )

