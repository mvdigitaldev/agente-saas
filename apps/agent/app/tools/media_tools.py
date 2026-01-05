from typing import Dict, Any
from tools.nest_client import NestClient
from utils.logging import get_logger

logger = get_logger(__name__)


async def send_media_tool(args: Dict[str, Any], context: Dict[str, str]) -> Dict[str, Any]:
    """
    Tool para enviar mídia (fotos, vídeos, documentos) via WhatsApp
    
    Args:
        args: Argumentos validados (url, media_type, caption opcional)
        context: Contexto explícito (empresa_id, conversation_id, client_id)
    
    Returns:
        Dict com sucesso do envio
    """
    try:
        nest_client = NestClient()
        
        data = {
            "empresa_id": context["empresa_id"],
            "conversation_id": context["conversation_id"],
            "url": args["url"],
            "media_type": args.get("media_type", "image"),
        }
        
        if args.get("caption"):
            data["caption"] = args["caption"]
        
        result = await nest_client.send_media(data)
        
        logger.info(f"Sent media {args['url']} for conversation {context['conversation_id']}, empresa {context['empresa_id']}")
        return result
        
    except Exception as e:
        logger.error(f"Error in send_media_tool: {e}", exc_info=True)
        return {"error": str(e)}

