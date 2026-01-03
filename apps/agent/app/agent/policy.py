import os
from supabase import create_client, Client
from utils.logging import get_logger

logger = get_logger(__name__)

class PolicyEngine:
    def __init__(self):
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        self.supabase: Client = create_client(supabase_url, supabase_key)

    def load_empresa_config(self, empresa_id: str) -> dict:
        try:
            response = self.supabase.table("agent_configs").select("*").eq("empresa_id", empresa_id).single().execute()
            return response.data or {}
        except Exception as e:
            logger.error(f"Error loading empresa config: {e}")
            return {}

    def load_empresa_features(self, empresa_id: str) -> dict:
        try:
            response = self.supabase.table("agent_features").select("*").eq("empresa_id", empresa_id).single().execute()
            return response.data or {}
        except Exception as e:
            logger.error(f"Error loading empresa features: {e}")
            return {}

    def should_ask_for_pix(self, empresa_id: str, features: dict) -> bool:
        return features.get("ask_for_pix", False)

    def should_require_deposit(self, empresa_id: str, features: dict) -> bool:
        return features.get("require_deposit", False)

