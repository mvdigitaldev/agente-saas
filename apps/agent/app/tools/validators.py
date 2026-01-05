from pydantic import BaseModel, validator, Field
from typing import Optional
from datetime import datetime
import re


# ============================================================================
# Scheduling Tools Validators
# ============================================================================

class CheckAvailableSlotsInput(BaseModel):
    """Validador para check_available_slots"""
    start_date: str = Field(..., description="Data de início no formato ISO 8601 (YYYY-MM-DD)")
    end_date: str = Field(..., description="Data de fim no formato ISO 8601 (YYYY-MM-DD)")
    service_id: Optional[str] = Field(None, description="ID do serviço (opcional)")
    
    @validator('start_date', 'end_date')
    def validate_date_format(cls, v):
        """Valida formato de data ISO"""
        try:
            datetime.fromisoformat(v.replace('Z', '+00:00'))
            return v
        except ValueError:
            raise ValueError(f"Data inválida: {v}. Use formato ISO 8601 (YYYY-MM-DD)")
    
    @validator('end_date')
    def validate_date_range(cls, v, values):
        """Valida que end_date é posterior a start_date"""
        if 'start_date' in values:
            try:
                start = datetime.fromisoformat(values['start_date'].replace('Z', '+00:00'))
                end = datetime.fromisoformat(v.replace('Z', '+00:00'))
                if end < start:
                    raise ValueError("end_date deve ser posterior a start_date")
            except (ValueError, KeyError):
                pass  # Já validado no validator anterior
        return v


class CreateAppointmentInput(BaseModel):
    """Validador para create_appointment"""
    client_id: str = Field(..., description="ID do cliente")
    service_id: str = Field(..., description="ID do serviço")
    start_time: str = Field(..., description="Data/hora de início no formato ISO 8601")
    end_time: str = Field(..., description="Data/hora de fim no formato ISO 8601")
    staff_id: Optional[str] = Field(None, description="ID do profissional (opcional)")
    resource_id: Optional[str] = Field(None, description="ID do recurso (opcional)")
    notes: Optional[str] = Field(None, description="Observações (opcional)")
    
    @validator('start_time', 'end_time')
    def validate_datetime_format(cls, v):
        """Valida formato de datetime ISO"""
        try:
            datetime.fromisoformat(v.replace('Z', '+00:00'))
            return v
        except ValueError:
            raise ValueError(f"Data/hora inválida: {v}. Use formato ISO 8601")
    
    @validator('end_time')
    def validate_time_range(cls, v, values):
        """Valida que end_time é posterior a start_time"""
        if 'start_time' in values:
            try:
                start = datetime.fromisoformat(values['start_time'].replace('Z', '+00:00'))
                end = datetime.fromisoformat(v.replace('Z', '+00:00'))
                if end <= start:
                    raise ValueError("end_time deve ser posterior a start_time")
            except (ValueError, KeyError):
                pass
        return v
    
    @validator('client_id', 'service_id')
    def validate_id_format(cls, v):
        """Valida formato básico de ID"""
        if not v or not v.strip():
            raise ValueError("ID não pode ser vazio")
        return v.strip()


class RescheduleAppointmentInput(BaseModel):
    """Validador para reschedule_appointment"""
    appointment_id: str = Field(..., description="ID do agendamento a ser reagendado")
    start_time: str = Field(..., description="Nova data/hora de início no formato ISO 8601")
    end_time: str = Field(..., description="Nova data/hora de fim no formato ISO 8601")
    
    @validator('appointment_id')
    def validate_appointment_id(cls, v):
        if not v or not v.strip():
            raise ValueError("appointment_id não pode ser vazio")
        return v.strip()
    
    @validator('start_time', 'end_time')
    def validate_datetime_format(cls, v):
        try:
            datetime.fromisoformat(v.replace('Z', '+00:00'))
            return v
        except ValueError:
            raise ValueError(f"Data/hora inválida: {v}. Use formato ISO 8601")
    
    @validator('end_time')
    def validate_time_range(cls, v, values):
        if 'start_time' in values:
            try:
                start = datetime.fromisoformat(values['start_time'].replace('Z', '+00:00'))
                end = datetime.fromisoformat(v.replace('Z', '+00:00'))
                if end <= start:
                    raise ValueError("end_time deve ser posterior a start_time")
            except (ValueError, KeyError):
                pass
        return v


class CancelAppointmentInput(BaseModel):
    """Validador para cancel_appointment"""
    appointment_id: str = Field(..., description="ID do agendamento a ser cancelado")
    
    @validator('appointment_id')
    def validate_appointment_id(cls, v):
        if not v or not v.strip():
            raise ValueError("appointment_id não pode ser vazio")
        return v.strip()


# ============================================================================
# Info Tools Validators
# ============================================================================

class ListStaffInput(BaseModel):
    """Validador para list_staff"""
    # Não requer parâmetros, mas aceita opcionais para filtros futuros
    pass


class ListServicesInput(BaseModel):
    """Validador para list_services"""
    # Não requer parâmetros obrigatórios
    active_only: Optional[bool] = Field(True, description="Listar apenas serviços ativos")


class ListAppointmentsInput(BaseModel):
    """Validador para list_appointments"""
    client_id: Optional[str] = Field(None, description="ID do cliente (opcional)")
    status: Optional[str] = Field(None, description="Status do agendamento (opcional)")
    start_date: Optional[str] = Field(None, description="Data de início para filtro (opcional)")
    end_date: Optional[str] = Field(None, description="Data de fim para filtro (opcional)")
    
    @validator('start_date', 'end_date')
    def validate_date_format(cls, v):
        if v is None:
            return v
        try:
            datetime.fromisoformat(v.replace('Z', '+00:00'))
            return v
        except ValueError:
            raise ValueError(f"Data inválida: {v}. Use formato ISO 8601")


class ListPricesInput(BaseModel):
    """Validador para list_prices"""
    # Reutiliza list_services, sem parâmetros obrigatórios
    pass


# ============================================================================
# Payment Tools Validators
# ============================================================================

class CheckPaymentStatusInput(BaseModel):
    """Validador para check_payment_status"""
    payment_id: str = Field(..., description="ID do pagamento ou appointment_id")
    
    @validator('payment_id')
    def validate_payment_id(cls, v):
        if not v or not v.strip():
            raise ValueError("payment_id não pode ser vazio")
        return v.strip()


class CreatePaymentLinkInput(BaseModel):
    """Validador para create_payment_link"""
    appointment_id: str = Field(..., description="ID do agendamento")
    amount: float = Field(..., gt=0, description="Valor do pagamento (deve ser maior que zero)")
    
    @validator('appointment_id')
    def validate_appointment_id(cls, v):
        if not v or not v.strip():
            raise ValueError("appointment_id não pode ser vazio")
        return v.strip()
    
    @validator('amount')
    def validate_amount(cls, v):
        if v <= 0:
            raise ValueError("amount deve ser maior que zero")
        return v


# ============================================================================
# Human Tools Validators
# ============================================================================

class RequestHumanHandoffInput(BaseModel):
    """Validador para request_human_handoff"""
    reason: Optional[str] = Field(None, description="Motivo da escalação (opcional)")
    # Não requer parâmetros obrigatórios


# ============================================================================
# Media Tools Validators
# ============================================================================

class SendMediaInput(BaseModel):
    """Validador para send_media"""
    url: str = Field(..., description="URL da mídia a ser enviada")
    media_type: Optional[str] = Field("image", description="Tipo de mídia (image, video, document)")
    caption: Optional[str] = Field(None, description="Legenda da mídia (opcional)")
    
    @validator('url')
    def validate_url(cls, v):
        if not v or not v.strip():
            raise ValueError("URL não pode ser vazia")
        # Validação básica de URL
        url_pattern = re.compile(
            r'^https?://'  # http:// or https://
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
            r'localhost|'  # localhost...
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
            r'(?::\d+)?'  # optional port
            r'(?:/?|[/?]\S+)$', re.IGNORECASE)
        if not url_pattern.match(v):
            raise ValueError(f"URL inválida: {v}")
        return v.strip()
    
    @validator('media_type')
    def validate_media_type(cls, v):
        allowed_types = ["image", "video", "document"]
        if v not in allowed_types:
            raise ValueError(f"media_type deve ser um de: {', '.join(allowed_types)}")
        return v


# ============================================================================
# Mapeamento de validators por nome de tool
# ============================================================================

VALIDATORS = {
    "check_available_slots": CheckAvailableSlotsInput,
    "create_appointment": CreateAppointmentInput,
    "reschedule_appointment": RescheduleAppointmentInput,
    "cancel_appointment": CancelAppointmentInput,
    "list_staff": ListStaffInput,
    "list_services": ListServicesInput,
    "list_appointments": ListAppointmentsInput,
    "list_prices": ListPricesInput,
    "check_payment_status": CheckPaymentStatusInput,
    "create_payment_link": CreatePaymentLinkInput,
    "request_human_handoff": RequestHumanHandoffInput,
    "send_media": SendMediaInput,
}


def get_validator(tool_name: str) -> Optional[type]:
    """Retorna o validador para uma tool"""
    return VALIDATORS.get(tool_name)

