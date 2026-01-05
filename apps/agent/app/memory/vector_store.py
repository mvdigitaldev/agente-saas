import os
from supabase import create_client, Client
from app.utils.logging import get_logger

logger = get_logger(__name__)

class VectorStore:
    def __init__(self):
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        self.supabase: Client = create_client(supabase_url, supabase_key)

    def search(
        self,
        empresa_id: str,
        client_id: str,
        query_text: str,
        limit: int = 5,
    ) -> list:
        try:
            # Buscar memórias relevantes usando pgvector
            # Nota: A busca vetorial precisa ser feita via SQL direto
            # Por enquanto, retornar busca simples por texto
            response = (
                self.supabase.table("memory_items")
                .select("*")
                .eq("empresa_id", empresa_id)
                .eq("client_id", client_id)
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            return response.data or []
        except Exception as e:
            logger.error(f"Error searching vector store: {e}")
            return []

    def extract_and_store_facts(
        self,
        empresa_id: str,
        client_id: str,
        conversation_id: str,
        messages: list,
    ):
        # Extrair fatos persistentes das mensagens
        # Implementação simplificada - em produção usar LLM para extração
        try:
            # Exemplo: extrair preferências mencionadas
            for msg in messages:
                content = msg.get("content", "").lower()
                if "prefiro" in content or "gosto" in content:
                    # Armazenar como memory_item
                    # Em produção, gerar embedding e armazenar
                    pass
        except Exception as e:
            logger.error(f"Error extracting facts: {e}")

