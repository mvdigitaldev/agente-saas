from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class AgentLLMResponse(BaseModel):
    """
    Schema estrito para resposta do LLM client.
    Garante que o AgentRunner sempre receba algo previsível.
    """
    content: Optional[str] = None
    tool_calls: Optional[List[Dict[str, Any]]] = None
    usage: Optional[Dict[str, Any]] = None
