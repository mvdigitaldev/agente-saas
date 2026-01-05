import os
import time
from supabase import create_client, Client
from app.utils.logging import get_logger

logger = get_logger(__name__)

class ContextLoader:
    def __init__(self):
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        self.supabase: Client = create_client(supabase_url, supabase_key)

    def load_short_term(self, conversation_id: str, limit: int = 20) -> list:
        try:
            response = (
                self.supabase.table("messages")
                .select("*")
                .eq("conversation_id", conversation_id)
                .order("created_at", desc=False)
                .limit(limit)
                .execute()
            )
            return response.data or []
        except Exception as e:
            logger.error(f"Error loading short-term memory: {e}")
            return []

    def load_summary(self, conversation_id: str) -> str:
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
            logger.error(f"Error loading summary: {e}")
            return ""

    def get_client_id(self, conversation_id: str) -> str:
        try:
            response = (
                self.supabase.table("conversations")
                .select("client_id")
                .eq("conversation_id", conversation_id)
                .single()
                .execute()
            )
            return response.data.get("client_id") if response.data else ""
        except Exception as e:
            logger.error(f"Error getting client_id: {e}")
            return ""

    def save_message(
        self,
        conversation_id: str,
        content: str,
        role: str,
        direction: str,
    ):
        try:
            # Buscar empresa_id e whatsapp_message_id
            conv_response = (
                self.supabase.table("conversations")
                .select("empresa_id")
                .eq("conversation_id", conversation_id)
                .single()
                .execute()
            )
            empresa_id = conv_response.data.get("empresa_id") if conv_response.data else ""

            # Gerar ID temporário (em produção, viria do Uazapi)
            whatsapp_message_id = f"outbound_{conversation_id}_{int(time.time())}"

            self.supabase.table("messages").insert({
                "empresa_id": empresa_id,
                "conversation_id": conversation_id,
                "whatsapp_message_id": whatsapp_message_id,
                "direction": direction,
                "role": role,
                "content": content,
            }).execute()
        except Exception as e:
            logger.error(f"Error saving message: {e}")

