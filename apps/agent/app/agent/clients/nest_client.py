import os
import httpx
from app.utils.logging import get_logger

logger = get_logger(__name__)

class NestClient:
    """
    Cliente para comunicação com o Backend NestJS.
    Responsável por enviar mensagens de volta para processamento/envio via WhatsApp.
    """
    def __init__(self):
        self.base_url = os.getenv("NEST_API_URL", "http://localhost:3000")
        self.api_key = os.getenv("NEST_API_KEY") 
        # Idealmente usar API Key ou internal token. Para simplificar MVP, assumiremos endpoint aberto ou protegido por IP/Network
        # Mas vamos deixar preparado para header.

    async def send_message(self, company_id: str, conversation_id: str, content: str):
        """
        Envia mensagem de resposta para o backend entregar ao usuário.
        Usa o endpoint existente do WhatsappModule.
        """
        url = f"{self.base_url}/whatsapp/send" 
        
        payload = {
            "empresa_id": company_id,
            "conversation_id": conversation_id,
            "message": content,
            # "direction": "outbound" # Não necessário para o DTO do backend, ele infere/handle
        }
        
        try:
            async with httpx.AsyncClient() as client:
                headers = {}
                if self.api_key:
                    headers["Authorization"] = f"Bearer {self.api_key}"
                
                response = await client.post(url, json=payload, headers=headers, timeout=10.0)
                response.raise_for_status()
                logger.info(f"✅ NestClient resposta enviada: {response.status_code}")
                return response.json()
                
        except Exception as e:
            logger.error(f"Erro ao enviar mensagem via NestClient: {e}", exc_info=True)
            raise
