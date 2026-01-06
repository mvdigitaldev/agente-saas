"""Memória de curto prazo (Redis) - últimas mensagens com TTL"""
import json
from typing import List, Dict
from app.config.redis_config import get_redis_client
from app.utils.logging import get_logger

logger = get_logger(__name__)

# Configurações
TTL_SECONDS = 30 * 60  # 30 minutos
MAX_MESSAGES = 20  # Últimas N mensagens (lista circular)


class ShortTermMemory:
    """
    Memória de curto prazo no Redis.
    - Chave: conversation:{company_id}:{conversation_id}
    - TTL: 30 minutos
    - Lista circular: apenas últimas N mensagens
    """
    
    def __init__(self):
        self.redis = get_redis_client()
    
    def _get_key(self, company_id: str, conversation_id: str) -> str:
        """Gera chave Redis no formato: conversation:{company_id}:{conversation_id}"""
        return f"conversation:{company_id}:{conversation_id}"
    
    async def get_context(
        self, 
        company_id: str, 
        conversation_id: str,
        limit: int = MAX_MESSAGES
    ) -> List[Dict]:
        """
        Retorna últimas N mensagens da conversa.
        
        Args:
            company_id: ID da empresa
            conversation_id: ID da conversa
            limit: Número máximo de mensagens (padrão: 20)
        
        Returns:
            Lista de mensagens no formato [{"role": "user|agent", "content": "..."}, ...]
        """
        key = self._get_key(company_id, conversation_id)
        
        try:
            # Buscar lista do Redis
            messages_json = await self.redis.lrange(key, 0, limit - 1)
            
            if not messages_json:
                return []
            
            # Parsear JSON de cada mensagem
            messages = []
            for msg_json in messages_json:
                try:
                    messages.append(json.loads(msg_json))
                except json.JSONDecodeError:
                    logger.warning(f"Erro ao parsear mensagem do Redis: {msg_json}")
            
            return messages
        except Exception as e:
            logger.error(f"Erro ao buscar memória curta: {e}", exc_info=e)
            return []
    
    async def count_messages(self, company_id: str, conversation_id: str) -> int:
        """Retorna contagem real de mensagens na lista"""
        key = self._get_key(company_id, conversation_id)
        try:
            return await self.redis.llen(key)
        except Exception as e:
            logger.error(f"Erro ao contar mensagens: {e}", exc_info=True)
            return 0

    async def is_job_processed(self, job_id: str) -> bool:
        """Verifica se job_id já foi processado (Idempotência)"""
        if not job_id:
            return False
        key = f"agent:processed:{job_id}"
        return bool(await self.redis.exists(key))

    async def mark_job_processed(self, job_id: str, ttl_seconds: int = 86400):
        """Marca job_id como processado"""
        if not job_id:
            return
        key = f"agent:processed:{job_id}"
        await self.redis.setex(key, ttl_seconds, "1")

    async def append(
        self,
        company_id: str,
        conversation_id: str,
        role: str,
        content: str
    ):
        """
        Adiciona mensagem à memória curta.
        """
        key = self._get_key(company_id, conversation_id)
        
        try:
            message = {
                "role": role,
                "content": content
            }
            message_json = json.dumps(message)
            
            async with self.redis.pipeline() as pipe:
                await pipe.rpush(key, message_json)
                await pipe.ltrim(key, -MAX_MESSAGES, -1)
                await pipe.expire(key, TTL_SECONDS)
                await pipe.execute()
            
            logger.debug(f"Mensagem adicionada à memória curta: {key}")
        except Exception as e:
            logger.error(f"Erro ao salvar memória curta: {e}", exc_info=e)
    
    async def clear(
        self,
        company_id: str,
        conversation_id: str
    ):
        """Remove toda a memória curta da conversa"""
        key = self._get_key(company_id, conversation_id)
        try:
            await self.redis.delete(key)
            logger.debug(f"Memória curta limpa: {key}")
        except Exception as e:
            logger.error(f"Erro ao limpar memória curta: {e}", exc_info=e)

