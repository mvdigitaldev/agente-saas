"""
Módulo de tools do agente
"""
from app.tools.scheduling_tools import (
    check_available_slots_tool,
    create_appointment_tool,
    reschedule_appointment_tool,
    cancel_appointment_tool,
)
from app.tools.info_tools import (
    list_staff_tool,
    list_services_tool,
    list_appointments_tool,
    list_prices_tool,
)
from app.tools.payment_tools import (
    check_payment_status_tool,
    create_payment_link_tool,
)
from app.tools.human_tools import request_human_handoff_tool
from app.tools.media_tools import send_media_tool
from app.tools.validators import get_validator
from app.agent.tools_registry import ToolDefinition, get_tool_registry


def register_all_tools():
    """Registra todas as tools no registry"""
    registry = get_tool_registry()
    
    # Scheduling tools
    registry.register_tool(ToolDefinition(
        name="check_available_slots",
        description="Buscar horários disponíveis para agendamento. Retorna slots livres, horários bloqueados e agendamentos existentes no período especificado.",
        parameters={
            "type": "object",
            "properties": {
                "start_date": {
                    "type": "string",
                    "description": "Data de início no formato ISO 8601 (YYYY-MM-DD). Exemplo: 2024-01-15"
                },
                "end_date": {
                    "type": "string",
                    "description": "Data de fim no formato ISO 8601 (YYYY-MM-DD). Deve ser posterior a start_date. Exemplo: 2024-01-20"
                },
                "service_id": {
                    "type": "string",
                    "description": "ID do serviço para filtrar disponibilidade (opcional)"
                },
            },
            "required": ["start_date", "end_date"],
        },
        executor=check_available_slots_tool,
        validator=get_validator("check_available_slots"),
    ))
    
    registry.register_tool(ToolDefinition(
        name="create_appointment",
        description="Criar um novo agendamento. Verifica conflitos automaticamente e cria o agendamento se o horário estiver disponível.",
        parameters={
            "type": "object",
            "properties": {
                "client_id": {"type": "string", "description": "ID do cliente"},
                "service_id": {"type": "string", "description": "ID do serviço"},
                "start_time": {
                    "type": "string",
                    "description": "Data/hora de início no formato ISO 8601. Exemplo: 2024-01-15T10:00:00Z"
                },
                "end_time": {
                    "type": "string",
                    "description": "Data/hora de fim no formato ISO 8601. Deve ser posterior a start_time. Exemplo: 2024-01-15T11:00:00Z"
                },
                "staff_id": {"type": "string", "description": "ID do profissional (opcional)"},
                "resource_id": {"type": "string", "description": "ID do recurso (opcional)"},
                "notes": {"type": "string", "description": "Observações sobre o agendamento (opcional)"},
            },
            "required": ["client_id", "service_id", "start_time", "end_time"],
        },
        executor=create_appointment_tool,
        validator=get_validator("create_appointment"),
    ))
    
    registry.register_tool(ToolDefinition(
        name="reschedule_appointment",
        description="Reagendar um agendamento existente. Atualiza a data/hora do agendamento para novos horários.",
        parameters={
            "type": "object",
            "properties": {
                "appointment_id": {"type": "string", "description": "ID do agendamento a ser reagendado"},
                "start_time": {
                    "type": "string",
                    "description": "Nova data/hora de início no formato ISO 8601. Exemplo: 2024-01-15T14:00:00Z"
                },
                "end_time": {
                    "type": "string",
                    "description": "Nova data/hora de fim no formato ISO 8601. Deve ser posterior a start_time. Exemplo: 2024-01-15T15:00:00Z"
                },
            },
            "required": ["appointment_id", "start_time", "end_time"],
        },
        executor=reschedule_appointment_tool,
        validator=get_validator("reschedule_appointment"),
    ))
    
    registry.register_tool(ToolDefinition(
        name="cancel_appointment",
        description="Cancelar um agendamento existente. Verifica políticas de cancelamento antes de cancelar.",
        parameters={
            "type": "object",
            "properties": {
                "appointment_id": {"type": "string", "description": "ID do agendamento a ser cancelado"},
            },
            "required": ["appointment_id"],
        },
        executor=cancel_appointment_tool,
        validator=get_validator("cancel_appointment"),
    ))
    
    # Info tools
    registry.register_tool(ToolDefinition(
        name="list_staff",
        description="Listar profissionais/staff disponíveis na empresa. Retorna lista com nomes, IDs e disponibilidade.",
        parameters={
            "type": "object",
            "properties": {},
            "required": [],
        },
        executor=list_staff_tool,
        validator=get_validator("list_staff"),
    ))
    
    registry.register_tool(ToolDefinition(
        name="list_services",
        description="Listar serviços disponíveis na empresa. Retorna lista com nomes, preços, duração e descrições.",
        parameters={
            "type": "object",
            "properties": {
                "active_only": {
                    "type": "boolean",
                    "description": "Listar apenas serviços ativos (padrão: true)"
                },
            },
            "required": [],
        },
        executor=list_services_tool,
        validator=get_validator("list_services"),
    ))
    
    registry.register_tool(ToolDefinition(
        name="list_appointments",
        description="Listar agendamentos do cliente. Permite filtrar por status, data e cliente específico.",
        parameters={
            "type": "object",
            "properties": {
                "client_id": {"type": "string", "description": "ID do cliente (opcional, usa cliente da conversa se não fornecido)"},
                "status": {"type": "string", "description": "Status do agendamento para filtrar (opcional). Ex: scheduled, confirmed, cancelled"},
                "start_date": {"type": "string", "description": "Data de início para filtro no formato ISO 8601 (opcional)"},
                "end_date": {"type": "string", "description": "Data de fim para filtro no formato ISO 8601 (opcional)"},
            },
            "required": [],
        },
        executor=list_appointments_tool,
        validator=get_validator("list_appointments"),
    ))
    
    registry.register_tool(ToolDefinition(
        name="list_prices",
        description="Listar preços/valores dos serviços. Retorna apenas informações de preço formatadas.",
        parameters={
            "type": "object",
            "properties": {},
            "required": [],
        },
        executor=list_prices_tool,
        validator=get_validator("list_prices"),
    ))
    
    # Payment tools
    registry.register_tool(ToolDefinition(
        name="check_payment_status",
        description="Verificar status de pagamento PIX. Retorna status atual do pagamento e link se ainda estiver pendente.",
        parameters={
            "type": "object",
            "properties": {
                "payment_id": {
                    "type": "string",
                    "description": "ID do pagamento ou appointment_id para verificar status"
                },
            },
            "required": ["payment_id"],
        },
        executor=check_payment_status_tool,
        validator=get_validator("check_payment_status"),
    ))
    
    registry.register_tool(ToolDefinition(
        name="create_payment_link",
        description="Criar link de pagamento PIX para um agendamento. Só funciona se ask_for_pix estiver habilitado para a empresa.",
        parameters={
            "type": "object",
            "properties": {
                "appointment_id": {"type": "string", "description": "ID do agendamento"},
                "amount": {
                    "type": "number",
                    "description": "Valor do pagamento (deve ser maior que zero)"
                },
            },
            "required": ["appointment_id", "amount"],
        },
        executor=create_payment_link_tool,
        validator=get_validator("create_payment_link"),
        required_features=["ask_for_pix"],
    ))
    
    # Human tools
    registry.register_tool(ToolDefinition(
        name="request_human_handoff",
        description="Escalar conversa para atendente humano. Marca a conversa como necessitando intervenção humana e notifica a equipe.",
        parameters={
            "type": "object",
            "properties": {
                "reason": {
                    "type": "string",
                    "description": "Motivo da escalação (opcional). Ex: cliente solicitou, problema técnico, etc."
                },
            },
            "required": [],
        },
        executor=request_human_handoff_tool,
        validator=get_validator("request_human_handoff"),
    ))
    
    # Media tools
    registry.register_tool(ToolDefinition(
        name="send_media",
        description="Enviar mídia (fotos, vídeos, documentos) via WhatsApp. Suporta imagens, vídeos e documentos.",
        parameters={
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "URL da mídia a ser enviada. Deve ser uma URL válida e acessível."
                },
                "media_type": {
                    "type": "string",
                    "enum": ["image", "video", "document"],
                    "description": "Tipo de mídia (padrão: image)"
                },
                "caption": {
                    "type": "string",
                    "description": "Legenda da mídia (opcional)"
                },
            },
            "required": ["url"],
        },
        executor=send_media_tool,
        validator=get_validator("send_media"),
    ))
