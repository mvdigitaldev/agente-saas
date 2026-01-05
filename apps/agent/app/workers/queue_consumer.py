import asyncio
import redis.asyncio as redis
import json
import os
from app.agent.core import AgentCore
from app.utils.logging import get_logger

logger = get_logger(__name__)

class QueueConsumer:
    def __init__(self):
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        # Configurar SSL se for rediss:// (Upstash)
        # Na versão 5.0.1 do redis, não usamos ssl=bool, mas sim ssl_cert_reqs
        if redis_url.startswith("rediss://"):
            # Para conexões SSL (Upstash), usar ssl_cert_reqs
            self.redis_client = redis.from_url(
                redis_url, 
                decode_responses=True,
                ssl_cert_reqs=None,  # Upstash usa certificado válido
            )
        else:
            # Para conexões não-SSL
            self.redis_client = redis.from_url(
                redis_url, 
                decode_responses=True,
            )
        self.agent = AgentCore()
        self.queue_name = "bull:process-inbound-message:wait"

    async def start(self):
        logger.info("Starting queue consumer...")
        while True:
            try:
                # Consumir job do BullMQ
                job_data = await self.consume_job()
                if job_data:
                    await self.process_job(job_data)
            except Exception as e:
                logger.error(f"Error processing job: {e}")
                await asyncio.sleep(1)

    async def consume_job(self):
        # BullMQ armazena jobs em listas Redis
        # Formato: BLPOP bull:process-inbound-message:wait
        try:
            result = await self.redis_client.blpop(self.queue_name, timeout=1)
            if result:
                _, job_json = result
                return json.loads(job_json)
        except Exception as e:
            logger.error(f"Error consuming job: {e}")
        return None

    async def process_job(self, job_data: dict):
        try:
            logger.info(f"Processing job: {job_data.get('id')}")
            
            # Processar mensagem com o agente
            await self.agent.process_message({
                "empresa_id": job_data.get("data", {}).get("empresa_id"),
                "conversation_id": job_data.get("data", {}).get("conversation_id"),
                "message_id": job_data.get("data", {}).get("message_id"),
                "whatsapp_message_id": job_data.get("data", {}).get("whatsapp_message_id"),
            })
            
            logger.info(f"Job {job_data.get('id')} processed successfully")
        except Exception as e:
            logger.error(f"Error processing job {job_data.get('id')}: {e}")
            raise

