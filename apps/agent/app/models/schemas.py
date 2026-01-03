from pydantic import BaseModel
from typing import Optional, List

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

