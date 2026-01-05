from typing import Dict, Any
from tools.nest_client import NestClient
from utils.logging import get_logger

logger = get_logger(__name__)


async def list_staff_tool(args: Dict[str, Any], context: Dict[str, str]) -> Dict[str, Any]:
    """
    Tool para listar profissionais/staff disponíveis
    
    Args:
        args: Argumentos (nenhum obrigatório por enquanto)
        context: Contexto explícito (empresa_id, conversation_id, client_id)
    
    Returns:
        Dict com lista de profissionais
    """
    try:
        nest_client = NestClient()
        
        params = {
            "empresa_id": context["empresa_id"],
        }
        
        result = await nest_client.list_staff(params)
        
        logger.info(f"Listed staff for empresa {context['empresa_id']}")
        return result
        
    except Exception as e:
        logger.error(f"Error in list_staff_tool: {e}", exc_info=True)
        return {"error": str(e)}


async def list_services_tool(args: Dict[str, Any], context: Dict[str, str]) -> Dict[str, Any]:
    """
    Tool para listar serviços disponíveis
    
    Args:
        args: Argumentos (active_only opcional)
        context: Contexto explícito (empresa_id, conversation_id, client_id)
    
    Returns:
        Dict com lista de serviços com preços e duração
    """
    try:
        nest_client = NestClient()
        
        params = {
            "empresa_id": context["empresa_id"],
        }
        
        if args.get("active_only") is not None:
            params["active_only"] = args["active_only"]
        
        result = await nest_client.list_services(params)
        
        logger.info(f"Listed services for empresa {context['empresa_id']}")
        return result
        
    except Exception as e:
        logger.error(f"Error in list_services_tool: {e}", exc_info=True)
        return {"error": str(e)}


async def list_appointments_tool(args: Dict[str, Any], context: Dict[str, str]) -> Dict[str, Any]:
    """
    Tool para listar agendamentos do cliente
    
    Args:
        args: Argumentos (client_id, status, start_date, end_date opcionais)
        context: Contexto explícito (empresa_id, conversation_id, client_id)
    
    Returns:
        Dict com lista de agendamentos
    """
    try:
        nest_client = NestClient()
        
        params = {
            "empresa_id": context["empresa_id"],
        }
        
        # Usar client_id do contexto se não fornecido
        client_id = args.get("client_id") or context.get("client_id")
        if client_id:
            params["client_id"] = client_id
        
        if args.get("status"):
            params["status"] = args["status"]
        if args.get("start_date"):
            params["start_date"] = args["start_date"]
        if args.get("end_date"):
            params["end_date"] = args["end_date"]
        
        result = await nest_client.list_appointments(params)
        
        logger.info(f"Listed appointments for empresa {context['empresa_id']}, client {client_id}")
        return result
        
    except Exception as e:
        logger.error(f"Error in list_appointments_tool: {e}", exc_info=True)
        return {"error": str(e)}


async def list_prices_tool(args: Dict[str, Any], context: Dict[str, str]) -> Dict[str, Any]:
    """
    Tool para listar preços/valores dos serviços
    Reutiliza list_services mas formata apenas preços
    
    Args:
        args: Argumentos (nenhum obrigatório)
        context: Contexto explícito (empresa_id, conversation_id, client_id)
    
    Returns:
        Dict com serviços e preços formatados
    """
    try:
        # Reutilizar list_services
        services_result = await list_services_tool(args, context)
        
        if "error" in services_result:
            return services_result
        
        # Formatar apenas preços
        services = services_result.get("services", [])
        prices = []
        
        for service in services:
            prices.append({
                "service_id": service.get("service_id"),
                "nome": service.get("nome"),
                "preco": service.get("preco"),
                "duracao_minutos": service.get("duracao_minutos"),
            })
        
        logger.info(f"Listed prices for empresa {context['empresa_id']}")
        return {"prices": prices}
        
    except Exception as e:
        logger.error(f"Error in list_prices_tool: {e}", exc_info=True)
        return {"error": str(e)}

