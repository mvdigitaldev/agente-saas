import os
from supabase import create_client, Client
from app.utils.logging import get_logger

logger = get_logger(__name__)

class SummaryWriter:
    def __init__(self):
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        self.supabase: Client = create_client(supabase_url, supabase_key)

    def update_summary_if_needed(self, conversation_id: str, messages: list):
        # Atualizar summary a cada 5 mensagens
        if len(messages) % 5 == 0:
            self._generate_summary(conversation_id, messages)

    def _generate_summary(self, conversation_id: str, messages: list):
        try:
            # Buscar summary atual
            current_summary = self._get_current_summary(conversation_id)

            # Gerar novo summary (simplificado - em produção usar LLM)
            new_summary = self._summarize_messages(messages, current_summary)

            # Atualizar no banco
            self.supabase.table("conversations").update({
                "summary": new_summary,
            }).eq("conversation_id", conversation_id).execute()

            logger.info(f"Summary updated for conversation {conversation_id}")
        except Exception as e:
            logger.error(f"Error updating summary: {e}")

    def _get_current_summary(self, conversation_id: str) -> str:
        try:
            response = (
                self.supabase.table("conversations")
                .select("summary")
                .eq("conversation_id", conversation_id)
                .single()
                .execute()
            )
            return response.data.get("summary") if response.data else ""
        except Exception as e:
            logger.error(f"Error getting current summary: {e}")
            return ""

    def _summarize_messages(self, messages: list, current_summary: str) -> str:
        # Implementação simplificada
        # Em produção, usar LLM para gerar summary
        if not messages:
            return current_summary

        recent_messages = messages[-5:]
        summary_parts = [current_summary] if current_summary else []
        summary_parts.append(f"Últimas mensagens: {len(recent_messages)}")

        return " | ".join(summary_parts)

