"""Memória de longo prazo (Postgres/Supabase) - persistência completa"""
import os
from typing import List, Dict, Optional
from supabase import create_client, Client
from app.utils.logging import get_logger

logger = get_logger(__name__)


class LongTermMemory:
    """
    Memória de longo prazo no Postgres (via Supabase).
    
    IMPORTANTE:
    - Persiste TODO o histórico
    - NUNCA injeta histórico completo no prompt
    - Carrega apenas: resumo, preferências, decisões relevantes
    """
    
    def __init__(self):
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url:
            raise RuntimeError("SUPABASE_URL não definida")
        if not supabase_key:
            raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY não definida")
        
        self.supabase: Client = create_client(supabase_url, supabase_key)
    
    async def save_message(
        self,
        company_id: str,
        conversation_id: str,
        role: str,
        content: str
    ):
        """
        Salva mensagem na memória longa.
        
        Args:
            company_id: ID da empresa
            conversation_id: ID da conversa
            role: "user", "agent" ou "system"
            content: Conteúdo da mensagem
        """
        try:
            self.supabase.table("agent_conversation_memory").insert({
                "company_id": company_id,
                "conversation_id": conversation_id,
                "role": role,
                "content": content,
            }).execute()
            
            logger.debug(
                f"Mensagem salva na memória longa: "
                f"company={company_id}, conversation={conversation_id}, role={role}"
            )
        except Exception as e:
            logger.error(f"Erro ao salvar memória longa: {e}", exc_info=e)
    
    async def load_recent(
        self,
        company_id: str,
        conversation_id: str,
        limit: int = 20
    ) -> List[Dict]:
        """
        Carrega mensagens recentes (últimas N).
        
        NOTA: Este método existe para compatibilidade, mas NÃO deve ser usado
        para injeção completa no prompt. Use load_summary() e load_preferences().
        
        Args:
            company_id: ID da empresa
            conversation_id: ID da conversa
            limit: Número máximo de mensagens
        
        Returns:
            Lista de mensagens
        """
        try:
            response = (
                self.supabase.table("agent_conversation_memory")
                .select("*")
                .eq("company_id", company_id)
                .eq("conversation_id", conversation_id)
                .order("created_at", desc=False)
                .limit(limit)
                .execute()
            )
            
            return response.data or []
        except Exception as e:
            logger.error(f"Erro ao carregar memória longa: {e}", exc_info=e)
            return []
    
    async def load_summary(
        self,
        company_id: str,
        conversation_id: str
    ) -> Optional[str]:
        """
        Carrega resumo da conversa (se existir).
        
        Este método busca resumos pré-computados ou gera um resumo
        das mensagens mais antigas.
        
        Args:
            company_id: ID da empresa
            conversation_id: ID da conversa
        
        Returns:
            Resumo da conversa ou None
        """
        # TODO: Implementar busca de resumo na tabela de conversas
        # Por enquanto, retorna None (será implementado na Fase 6)
        return None
    
    async def load_preferences(
        self,
        company_id: str,
        conversation_id: str
    ) -> List[Dict]:
        """
        Carrega preferências do cliente extraídas da conversa.
        
        Exemplos: preferências de horário, produtos, formas de pagamento, etc.
        
        Args:
            company_id: ID da empresa
            conversation_id: ID da conversa
        
        Returns:
            Lista de preferências no formato [{"type": "...", "value": "..."}, ...]
        """
        # TODO: Implementar extração de preferências (Fase 6)
        # Por enquanto, retorna lista vazia
        return []
    
    async def load_relevant_decisions(
        self,
        company_id: str,
        conversation_id: str
    ) -> List[Dict]:
        """
        Carrega decisões relevantes anteriores (agendamentos, pagamentos, etc).
        
        Args:
            company_id: ID da empresa
            conversation_id: ID da conversa
        
        Returns:
            Lista de decisões no formato [{"type": "...", "details": "..."}, ...]
        """
        # TODO: Implementar busca de decisões relevantes (Fase 6)
        # Por enquanto, retorna lista vazia
        return []

