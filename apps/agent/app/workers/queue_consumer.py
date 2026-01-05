import asyncio
import redis.asyncio as redis
import json
import os
from urllib.parse import urlparse
from app.agent.core import AgentCore
from app.utils.logging import get_logger

logger = get_logger(__name__)

class QueueConsumer:
    def __init__(self):
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        
        # Corrigir URL do Upstash: remover username "default" se presente
        # Formato correto Upstash: rediss://:PASSWORD@HOST:PORT (sem username)
        original_url = redis_url
        if redis_url.startswith("rediss://"):
            # Remover qualquer username da URL (Upstash não usa username)
            # Formato esperado: rediss://default:PASSWORD@HOST:PORT
            # Formato correto: rediss://:PASSWORD@HOST:PORT
            try:
                parsed = urlparse(redis_url)
                # Se tem username (netloc contém username:password@host), remover username
                if parsed.username and parsed.username != "":
                    # Reconstruir URL sem username, apenas com password
                    if parsed.password:
                        port = f":{parsed.port}" if parsed.port else ":6379"
                        redis_url = f"rediss://:{parsed.password}@{parsed.hostname}{port}"
                        logger.info(f"URL do Redis corrigida: removido username '{parsed.username}'")
                    else:
                        logger.warning("URL do Redis tem username mas não tem password!")
                elif "default:" in redis_url:
                    # Fallback: remover "default:" diretamente se urlparse não funcionou
                    redis_url = redis_url.replace("rediss://default:", "rediss://:")
                    logger.info("URL do Redis corrigida: removido username 'default' (fallback)")
            except Exception as e:
                logger.warning(f"Erro ao processar URL do Redis: {e}")
                # Fallback: tentar remover "default:" diretamente
                if "default:" in redis_url:
                    redis_url = redis_url.replace("rediss://default:", "rediss://:")
                    logger.info("URL do Redis corrigida: removido username 'default' (fallback após erro)")
        
        logger.info(f"Conectando ao Redis (URL original: {original_url[:30]}...)")
        
        # Na versão 5.0.1 do redis, from_url detecta SSL automaticamente pela URL (rediss://)
        # Para Upstash, usar from_url sem parâmetros SSL adicionais
        try:
            # Usar from_url que detecta SSL automaticamente
            self.redis_client = redis.from_url(
                redis_url, 
                decode_responses=True,
            )
            logger.info("Cliente Redis criado com sucesso")
            logger.info(f"URL usada: {redis_url[:50]}..." if len(redis_url) > 50 else f"URL usada: {redis_url}")
        except Exception as e:
            logger.error(f"Erro ao criar cliente Redis: {e}")
            logger.error(f"URL original: {original_url[:50]}...")
            logger.error(f"URL corrigida: {redis_url[:50]}...")
            # Tentar criar conexão manualmente como fallback (não usar - from_url deve funcionar)
            raise
        
        self.agent = AgentCore()
        self.queue_name = "bull:process-inbound-message:wait"

    async def start(self):
        logger.info("Starting queue consumer...")
        
        # Testar conexão antes de começar
        try:
            await self.redis_client.ping()
            logger.info("Conexão Redis testada com sucesso (PING)")
        except Exception as e:
            logger.error(f"Erro ao testar conexão Redis: {e}")
            logger.error("Verifique se a REDIS_URL está correta no Render")
            raise
        
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

