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
    
    async def append(
        self,
        company_id: str,
        conversation_id: str,
        role: str,
        content: str
    ):
        """
        Adiciona mensagem à memória curta.
        Mantém apenas últimas N mensagens (lista circular).
        
        Args:
            company_id: ID da empresa
            conversation_id: ID da conversa
            role: "user" ou "agent"
            content: Conteúdo da mensagem
        """
        key = self._get_key(company_id, conversation_id)
        
        try:
            message = {
                "role": role,
                "content": content
            }
            message_json = json.dumps(message)
            
            # Adicionar à lista (lado direito)
            await self.redis.rpush(key, message_json)
            
            # Manter apenas últimas N mensagens (lista circular)
            # Remover mensagens antigas além do limite
            await self.redis.ltrim(key, -MAX_MESSAGES, -1)
            
            # Definir TTL (renova a cada append)
            await self.redis.expire(key, TTL_SECONDS)
            
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

