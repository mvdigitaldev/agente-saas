import os
import httpx
from app.utils.logging import get_logger

logger = get_logger(__name__)

class NestClient:
    def __init__(self):
        self.base_url = os.getenv("NEST_API_URL", "http://localhost:3001")
        self.api_key = os.getenv("AGENT_API_KEY")

    async def get_available_slots(self, params: dict):
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/tools/available-slots",
                    params=params,
                    headers={"X-Agent-API-Key": self.api_key},
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Error calling get_available_slots: {e}")
            return {"error": str(e)}

    async def create_appointment(self, data: dict):
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/tools/appointments",
                    json=data,
                    headers={"X-Agent-API-Key": self.api_key},
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Error calling create_appointment: {e}")
            return {"error": str(e)}

    async def create_payment_link(self, data: dict):
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/tools/payment-link",
                    json=data,
                    headers={"X-Agent-API-Key": self.api_key},
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Error calling create_payment_link: {e}")
            return {"error": str(e)}

    async def send_message(self, data: dict):
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/whatsapp/send",
                    json=data,
                    headers={"X-Agent-API-Key": self.api_key},
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Error calling send_message: {e}")
            return {"error": str(e)}

    async def reschedule_appointment(self, appointment_id: str, data: dict):
        """Reagendar um agendamento existente"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.patch(
                    f"{self.base_url}/tools/appointments/{appointment_id}",
                    json=data,
                    headers={"X-Agent-API-Key": self.api_key},
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error calling reschedule_appointment: {e.response.status_code} - {e.response.text}")
            return {"error": f"HTTP {e.response.status_code}: {e.response.text}"}
        except Exception as e:
            logger.error(f"Error calling reschedule_appointment: {e}")
            return {"error": str(e)}

    async def cancel_appointment(self, appointment_id: str, params: dict):
        """Cancelar um agendamento"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.delete(
                    f"{self.base_url}/tools/appointments/{appointment_id}",
                    params=params,
                    headers={"X-Agent-API-Key": self.api_key},
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error calling cancel_appointment: {e.response.status_code} - {e.response.text}")
            return {"error": f"HTTP {e.response.status_code}: {e.response.text}"}
        except Exception as e:
            logger.error(f"Error calling cancel_appointment: {e}")
            return {"error": str(e)}

    async def list_appointments(self, params: dict):
        """Listar agendamentos com filtros"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/tools/appointments",
                    params=params,
                    headers={"X-Agent-API-Key": self.api_key},
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error calling list_appointments: {e.response.status_code} - {e.response.text}")
            return {"error": f"HTTP {e.response.status_code}: {e.response.text}"}
        except Exception as e:
            logger.error(f"Error calling list_appointments: {e}")
            return {"error": str(e)}

    async def list_staff(self, params: dict):
        """Listar profissionais/staff"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/tools/staff",
                    params=params,
                    headers={"X-Agent-API-Key": self.api_key},
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error calling list_staff: {e.response.status_code} - {e.response.text}")
            return {"error": f"HTTP {e.response.status_code}: {e.response.text}"}
        except Exception as e:
            logger.error(f"Error calling list_staff: {e}")
            return {"error": str(e)}

    async def list_services(self, params: dict):
        """Listar serviços disponíveis"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/tools/services",
                    params=params,
                    headers={"X-Agent-API-Key": self.api_key},
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error calling list_services: {e.response.status_code} - {e.response.text}")
            return {"error": f"HTTP {e.response.status_code}: {e.response.text}"}
        except Exception as e:
            logger.error(f"Error calling list_services: {e}")
            return {"error": str(e)}

    async def human_handoff(self, data: dict):
        """Escalar conversa para atendente humano"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/tools/human-handoff",
                    json=data,
                    headers={"X-Agent-API-Key": self.api_key},
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error calling human_handoff: {e.response.status_code} - {e.response.text}")
            return {"error": f"HTTP {e.response.status_code}: {e.response.text}"}
        except Exception as e:
            logger.error(f"Error calling human_handoff: {e}")
            return {"error": str(e)}

    async def send_media(self, data: dict):
        """Enviar mídia via WhatsApp"""
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:  # Timeout maior para upload de mídia
                response = await client.post(
                    f"{self.base_url}/whatsapp/send-media",
                    json=data,
                    headers={"X-Agent-API-Key": self.api_key},
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error calling send_media: {e.response.status_code} - {e.response.text}")
            return {"error": f"HTTP {e.response.status_code}: {e.response.text}"}
        except Exception as e:
            logger.error(f"Error calling send_media: {e}")
            return {"error": str(e)}

    async def check_payment_status(self, payment_id: str, params: dict):
        """Verificar status de pagamento PIX"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/tools/payment-status/{payment_id}",
                    params=params,
                    headers={"X-Agent-API-Key": self.api_key},
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error calling check_payment_status: {e.response.status_code} - {e.response.text}")
            return {"error": f"HTTP {e.response.status_code}: {e.response.text}"}
        except Exception as e:
            logger.error(f"Error calling check_payment_status: {e}")
            return {"error": str(e)}

