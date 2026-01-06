
import os
from supabase import create_client, Client
from app.utils.logging import get_logger

logger = get_logger(__name__)

def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        logger.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in environment variables")
        raise ValueError("Missing Supabase credentials")
        
    return create_client(url, key)
