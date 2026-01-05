from typing import Dict, Any
from app.tools.nest_client import NestClient
from app.utils.logging import get_logger

logger = get_logger(__name__)


async def request_human_handoff_tool(args: Dict[str, Any], context: Dict[str, str]) -> Dict[str, Any]:
    """
    Tool para escalar conversa para atendente humano
    
    Args:
        args: Argumentos (reason opcional)
        context: Contexto explícito (empresa_id, conversation_id, client_id)
    
    Returns:
        Dict com sucesso da escalação
    """
    try:
        nest_client = NestClient()
        
        data = {
            "empresa_id": context["empresa_id"],
            "conversation_id": context["conversation_id"],
        }
        
        if args.get("reason"):
            data["reason"] = args["reason"]
        
        result = await nest_client.human_handoff(data)
        
        logger.info(f"Requested human handoff for conversation {context['conversation_id']}, empresa {context['empresa_id']}")
        return result
        
    except Exception as e:
        logger.error(f"Error in request_human_handoff_tool: {e}", exc_info=True)
        return {"error": str(e)}

