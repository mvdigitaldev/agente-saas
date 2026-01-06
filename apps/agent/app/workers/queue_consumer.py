import asyncio
import json
import os

import redis.asyncio as redis

from app.agent.core import AgentCore
from app.utils.logging import get_logger

logger = get_logger(__name__)


class QueueConsumer:
    def __init__(self):
        self.redis_url = os.getenv("REDIS_URL")
        if not self.redis_url:
            raise RuntimeError("REDIS_URL não definida")

        # ✅ Upstash: rediss:// já ativa TLS automaticamente
        self.redis = redis.from_url(
            self.redis_url,
            decode_responses=True,
        )

        self.agent = AgentCore()
        self.queue_name = "bull:process-inbound-message:wait"

    async def start(self):
        logger.info("🚀 Starting queue consumer...")

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
                logger.error(f"❌ Error processing job: {e}", exc_info=e)
                await asyncio.sleep(1)

    async def consume_job(self):
        try:
            result = await self.redis.blpop(self.queue_name, timeout=1)
            if result:
                _, job_json = result
                return json.loads(job_json)
        except Exception as e:
            logger.error(f"❌ Error consuming job: {e}", exc_info=e)
        return None

    async def process_job(self, job_data: dict):
        logger.info(f"📦 Processing job {job_data.get('id')}")

        await self.agent.process_message(
            job_data.get("data", {})
        )

        logger.info(f"✅ Job {job_data.get('id')} processed")
