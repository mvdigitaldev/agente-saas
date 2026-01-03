import os
import httpx
from utils.logging import get_logger

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

