from pydantic import BaseModel, field_validator
from typing import Optional, List, Dict
from datetime import datetime

class AgentJob(BaseModel):
    """Schema fixo para jobs consumidos do BullMQ"""
    job_id: str
    company_id: str
    conversation_id: str
    message: str
    channel: str
    metadata: Optional[Dict] = None
    created_at: datetime
    
    @field_validator('created_at', mode='before')
    @classmethod
    def parse_created_at(cls, v):
        """Aceita datetime, string ISO ou None (usa now() se None)"""
        if v is None:
            return datetime.now()
        if isinstance(v, str):
            # Tentar parsear ISO format
            try:
                return datetime.fromisoformat(v.replace('Z', '+00:00'))
            except:
                return datetime.now()
        return v

class MessageData(BaseModel):
    empresa_id: str
    conversation_id: str
    message_id: str
    whatsapp_message_id: str

class AgentConfig(BaseModel):
    tone: Optional[str] = None
    rules: Optional[str] = None
    policies: Optional[dict] = {}

class AgentFeatures(BaseModel):
    ask_for_pix: bool = False
    require_deposit: bool = False
    auto_confirmations_48h: bool = True
    auto_confirmations_24h: bool = True
    auto_confirmations_2h: bool = True
    waitlist_enabled: bool = False
    marketing_campaigns: bool = False

