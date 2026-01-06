import asyncio
import json

from app.config.redis_config import get_redis_client
from app.models.schemas import AgentJob
from app.agent.core.agent_runner import AgentRunner
from app.utils.logging import get_logger

logger = get_logger(__name__)


class QueueConsumer:
    def __init__(self):
        # Conectar ao Redis Cloud (TCP + TLS)
        self.redis = get_redis_client()
        
        # Nome da fila BullMQ
        self.queue_name = "bull:process-inbound-message:wait"

    async def start(self):
        logger.info("🚀 Starting queue consumer...")

        try:
            await self.redis.ping()
            logger.info("✅ Conectado ao Redis Cloud (TCP + TLS) com sucesso")
        except Exception as e:
            logger.error("❌ Falha ao conectar no Redis Cloud", exc_info=e)
            raise

        logger.info(f"📡 Aguardando jobs na fila: {self.queue_name}")
        
        while True:
            try:
                job_data = await self.consume_job()
                if job_data:
                    # Validar e processar job
                    try:
                        # BullMQ retorna job com estrutura: {id, data, ...}
                        # O payload real está em job_data.get("data", {})
                        payload = job_data.get("data", job_data)
                        
                        # Criar AgentJob a partir do payload
                        agent_job = AgentJob(**payload)
                        
                        # Delegar para AgentRunner
                        runner = AgentRunner()
                        await runner.handle(agent_job)
                    except Exception as e:
                        logger.error(f"❌ Erro ao processar job: {e}", exc_info=e)
            except Exception as e:
                logger.error(f"❌ Error consuming job: {e}", exc_info=e)
                await asyncio.sleep(1)

    async def consume_job(self):
        """
        Consome job do BullMQ.
        BullMQ armazena jobs em lista Redis com formato específico.
        """
        try:
            # BullMQ usa BLPOP na lista de wait
            result = await self.redis.blpop(self.queue_name, timeout=1)
            if result:
                _, job_json = result
                job_data = json.loads(job_json)
                return job_data
        except Exception as e:
            logger.error(f"❌ Error consuming job: {e}", exc_info=e)
        return None
