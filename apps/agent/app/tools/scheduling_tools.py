from typing import Dict, Any
from tools.nest_client import NestClient
from tools.validators import (
    CheckAvailableSlotsInput,
    CreateAppointmentInput,
    RescheduleAppointmentInput,
    CancelAppointmentInput,
)
from utils.logging import get_logger

logger = get_logger(__name__)


async def check_available_slots_tool(args: Dict[str, Any], context: Dict[str, str]) -> Dict[str, Any]:
    """
    Tool para verificar horários disponíveis
    
    Args:
        args: Argumentos validados (start_date, end_date, service_id opcional)
        context: Contexto explícito (empresa_id, conversation_id, client_id)
    
    Returns:
        Dict com available_slots, blocked_times, appointments
    """
    try:
        nest_client = NestClient()
        
        # Sempre incluir empresa_id do contexto
        params = {
            "empresa_id": context["empresa_id"],
            "start_date": args["start_date"],
            "end_date": args["end_date"],
        }
        
        if args.get("service_id"):
            params["service_id"] = args["service_id"]
        
        result = await nest_client.get_available_slots(params)
        
        logger.info(f"Checked available slots for empresa {context['empresa_id']}")
        return result
        
    except Exception as e:
        logger.error(f"Error in check_available_slots_tool: {e}", exc_info=True)
        return {"error": str(e)}


async def create_appointment_tool(args: Dict[str, Any], context: Dict[str, str]) -> Dict[str, Any]:
    """
    Tool para criar um novo agendamento
    
    Args:
        args: Argumentos validados (client_id, service_id, start_time, end_time, etc.)
        context: Contexto explícito (empresa_id, conversation_id, client_id)
    
    Returns:
        Dict com appointment_id e dados do agendamento criado
    """
    try:
        nest_client = NestClient()
        
        # Sempre incluir empresa_id do contexto
        data = {
            "empresa_id": context["empresa_id"],
            "client_id": args["client_id"],
            "service_id": args["service_id"],
            "start_time": args["start_time"],
            "end_time": args["end_time"],
        }
        
        # Campos opcionais
        if args.get("staff_id"):
            data["staff_id"] = args["staff_id"]
        if args.get("resource_id"):
            data["resource_id"] = args["resource_id"]
        if args.get("notes"):
            data["notes"] = args["notes"]
        
        result = await nest_client.create_appointment(data)
        
        logger.info(f"Created appointment for empresa {context['empresa_id']}, client {args['client_id']}")
        return result
        
    except Exception as e:
        logger.error(f"Error in create_appointment_tool: {e}", exc_info=True)
        return {"error": str(e)}


async def reschedule_appointment_tool(args: Dict[str, Any], context: Dict[str, str]) -> Dict[str, Any]:
    """
    Tool para reagendar um agendamento existente
    
    Args:
        args: Argumentos validados (appointment_id, start_time, end_time)
        context: Contexto explícito (empresa_id, conversation_id, client_id)
    
    Returns:
        Dict com dados do agendamento atualizado
    """
    try:
        nest_client = NestClient()
        
        appointment_id = args["appointment_id"]
        
        data = {
            "empresa_id": context["empresa_id"],
            "start_time": args["start_time"],
            "end_time": args["end_time"],
        }
        
        result = await nest_client.reschedule_appointment(appointment_id, data)
        
        logger.info(f"Rescheduled appointment {appointment_id} for empresa {context['empresa_id']}")
        return result
        
    except Exception as e:
        logger.error(f"Error in reschedule_appointment_tool: {e}", exc_info=True)
        return {"error": str(e)}


async def cancel_appointment_tool(args: Dict[str, Any], context: Dict[str, str]) -> Dict[str, Any]:
    """
    Tool para cancelar um agendamento
    
    Args:
        args: Argumentos validados (appointment_id)
        context: Contexto explícito (empresa_id, conversation_id, client_id)
    
    Returns:
        Dict com sucesso ou erro
    """
    try:
        nest_client = NestClient()
        
        appointment_id = args["appointment_id"]
        
        result = await nest_client.cancel_appointment(
            appointment_id,
            {"empresa_id": context["empresa_id"]}
        )
        
        logger.info(f"Cancelled appointment {appointment_id} for empresa {context['empresa_id']}")
        return result
        
    except Exception as e:
        logger.error(f"Error in cancel_appointment_tool: {e}", exc_info=True)
        return {"error": str(e)}

