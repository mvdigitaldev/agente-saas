"""Memória de curto prazo (in-memory) - últimas mensagens com TTL"""
import asyncio
import json
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from app.utils.logging import get_logger

logger = get_logger(__name__)

# Configurações
TTL_SECONDS = 30 * 60  # 30 minutos
MAX_MESSAGES = 20  # Últimas N mensagens (lista circular)


class InMemoryStore:
    """Armazenamento em memória com TTL automático"""
    
    def __init__(self):
        self._data: Dict[str, Dict] = {}
        self._cleanup_task: Optional[asyncio.Task] = None
        self._start_cleanup()
    
    def _start_cleanup(self):
        """Inicia task de limpeza periódica"""
        async def cleanup_loop():
            while True:
                await asyncio.sleep(60)  # Limpar a cada minuto
                await self._cleanup_expired()
        
        self._cleanup_task = asyncio.create_task(cleanup_loop())
    
    async def _cleanup_expired(self):
        """Remove entradas expiradas"""
        now = datetime.now()
        expired_keys = [
            key for key, value in self._data.items()
            if value.get('expires_at') and value['expires_at'] < now
        ]
        for key in expired_keys:
            del self._data[key]
    
    def set(self, key: str, value: any, ttl_seconds: int = TTL_SECONDS):
        """Armazena valor com TTL"""
        expires_at = datetime.now() + timedelta(seconds=ttl_seconds)
        self._data[key] = {
            'value': value,
            'expires_at': expires_at
        }
    
    def get(self, key: str) -> Optional[any]:
        """Recupera valor se não expirado"""
        entry = self._data.get(key)
        if not entry:
            return None
        
        if entry.get('expires_at') and entry['expires_at'] < datetime.now():
            del self._data[key]
            return None
        
        return entry['value']
    
    def exists(self, key: str) -> bool:
        """Verifica se chave existe e não expirou"""
        return self.get(key) is not None
    
    def delete(self, key: str):
        """Remove chave"""
        self._data.pop(key, None)
    
    def lpush(self, key: str, value: str):
        """Adiciona ao início da lista"""
        lst = self.get(key) or []
        lst.insert(0, value)
        # Limitar tamanho
        if len(lst) > MAX_MESSAGES:
            lst = lst[:MAX_MESSAGES]
        self.set(key, lst)
    
    def rpush(self, key: str, value: str):
        """Adiciona ao fim da lista"""
        lst = self.get(key) or []
        lst.append(value)
        # Limitar tamanho
        if len(lst) > MAX_MESSAGES:
            lst = lst[-MAX_MESSAGES:]
        # Atualizar com TTL padrão
        expires_at = datetime.now() + timedelta(seconds=TTL_SECONDS)
        self._data[key] = {
            'value': lst,
            'expires_at': expires_at
        }
    
    def lrange(self, key: str, start: int, end: int) -> List[str]:
        """Retorna range da lista"""
        lst = self.get(key) or []
        return lst[start:end+1] if end >= 0 else lst[start:]
    
    def llen(self, key: str) -> int:
        """Retorna tamanho da lista"""
        lst = self.get(key) or []
        return len(lst)
    
    def ltrim(self, key: str, start: int, end: int):
        """Trima lista mantendo apenas range"""
        lst = self.get(key) or []
        trimmed = lst[start:end+1] if end >= 0 else lst[start:]
        self.set(key, trimmed)


# Instância global do store
_store = InMemoryStore()


class ShortTermMemory:
    """
    Memória de curto prazo em RAM (in-memory).
    - Chave: conversation:{company_id}:{conversation_id}
    - TTL: 30 minutos
    - Lista circular: apenas últimas N mensagens
    """
    
    def __init__(self):
        self.store = _store
    
    def _get_key(self, company_id: str, conversation_id: str) -> str:
        """Gera chave no formato: conversation:{company_id}:{conversation_id}"""
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
            # Buscar lista do store
            messages_json = self.store.lrange(key, 0, limit - 1)
            
            if not messages_json:
                return []
            
            # Parsear JSON de cada mensagem
            messages = []
            for msg_json in messages_json:
                try:
                    messages.append(json.loads(msg_json))
                except json.JSONDecodeError:
                    logger.warning(f"Erro ao parsear mensagem: {msg_json}")
            
            return messages
        except Exception as e:
            logger.error(f"Erro ao buscar memória curta: {e}", exc_info=e)
            return []
    
    async def count_messages(self, company_id: str, conversation_id: str) -> int:
        """Retorna contagem real de mensagens na lista"""
        key = self._get_key(company_id, conversation_id)
        try:
            return self.store.llen(key)
        except Exception as e:
            logger.error(f"Erro ao contar mensagens: {e}", exc_info=True)
            return 0
    
    async def is_job_processed(self, job_id: str) -> bool:
        """Verifica se job_id já foi processado (Idempotência)"""
        if not job_id:
            return False
        key = f"agent:processed:{job_id}"
        return self.store.exists(key)
    
    async def mark_job_processed(self, job_id: str, ttl_seconds: int = 86400):
        """Marca job_id como processado"""
        if not job_id:
            return
        key = f"agent:processed:{job_id}"
        self.store.set(key, "1", ttl_seconds)
    
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
            
            # Adicionar mensagem ao fim da lista
            self.store.rpush(key, message_json)
            
            # Garantir TTL - recuperar lista atual e redefinir com TTL
            current_list = self.store.get(key) or []
            self.store.set(key, current_list, TTL_SECONDS)
            
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
            self.store.delete(key)
            logger.debug(f"Memória curta limpa: {key}")
        except Exception as e:
            logger.error(f"Erro ao limpar memória curta: {e}", exc_info=e)

