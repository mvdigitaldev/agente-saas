import asyncio
import redis.asyncio as redis
import json
import os
from app.agent.core import AgentCore
from app.utils.logging import get_logger

logger = get_logger(__name__)

class QueueConsumer:
    def __init__(self):
        self.redis_url = os.getenv("REDIS_URL")
        if not self.redis_url:
            raise RuntimeError("REDIS_URL não definida")

        self.redis = redis.from_url(
            self.redis_url,
            decode_responses=True,
            ssl=True,  # obrigatório para Upstash
        )

        self.agent = AgentCore()
        self.queue_name = "bull:process-inbound-message:wait"

    async def start(self):
        logger.info("🚀 Starting queue consumer...")

        # Teste simples de conexão
        try:
            await self.redis.ping()
            logger.info("✅ Conectado ao Redis (Upstash) com sucesso")
        except Exception as e:
            logger.error("❌ Falha ao conectar no Redis", exc_info=e)
            raise

        while True:
            try:
                job_data = await self.consume_job()
                if job_data:
                    await self.process_job(job_data)
            except Exception as e:
                logger.error(f"Error processing job: {e}")
                await asyncio.sleep(1)

    async def consume_job(self):
        try:
            result = await self.redis.blpop(self.queue_name, timeout=1)
            if result:
                _, job_json = result
                return json.loads(job_json)
        except Exception as e:
            logger.error(f"Error consuming job: {e}")
        return None

    async def process_job(self, job_data: dict):
        try:
            logger.info(f"Processing job: {job_data.get('id')}")

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
