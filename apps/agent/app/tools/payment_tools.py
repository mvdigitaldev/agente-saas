from typing import Dict, Any
from app.tools.nest_client import NestClient
from app.utils.logging import get_logger

logger = get_logger(__name__)


async def check_payment_status_tool(args: Dict[str, Any], context: Dict[str, str]) -> Dict[str, Any]:
    """
    Tool para verificar status de pagamento PIX
    
    Args:
        args: Argumentos validados (payment_id)
        context: Contexto explícito (empresa_id, conversation_id, client_id)
    
    Returns:
        Dict com status do pagamento, link se pendente
    """
    try:
        nest_client = NestClient()
        
        payment_id = args["payment_id"]
        
        result = await nest_client.check_payment_status(
            payment_id,
            {"empresa_id": context["empresa_id"]}
        )
        
        logger.info(f"Checked payment status {payment_id} for empresa {context['empresa_id']}")
        return result
        
    except Exception as e:
        logger.error(f"Error in check_payment_status_tool: {e}", exc_info=True)
        return {"error": str(e)}


async def create_payment_link_tool(args: Dict[str, Any], context: Dict[str, str]) -> Dict[str, Any]:
    """
    Tool para criar link de pagamento PIX
    
    Args:
        args: Argumentos validados (appointment_id, amount)
        context: Contexto explícito (empresa_id, conversation_id, client_id)
    
    Returns:
        Dict com payment_link_id e URL do pagamento
    """
    try:
        nest_client = NestClient()
        
        data = {
            "empresa_id": context["empresa_id"],
            "appointment_id": args["appointment_id"],
            "amount": args["amount"],
        }
        
        result = await nest_client.create_payment_link(data)
        
        logger.info(f"Created payment link for appointment {args['appointment_id']}, empresa {context['empresa_id']}")
        return result
        
    except Exception as e:
        logger.error(f"Error in create_payment_link_tool: {e}", exc_info=True)
        return {"error": str(e)}

