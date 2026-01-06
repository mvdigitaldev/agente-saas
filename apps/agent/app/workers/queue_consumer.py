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
        original_url = redis_url
        
        # Limpar e normalizar URL do Redis
        # Remover todos os espaços e garantir formato correto
        redis_url = redis_url.strip()
        # Remover espaços após "default:" (pode ter espaço no Render)
        redis_url = redis_url.replace("default: ", "default:")
        # Remover espaços em qualquer lugar da URL
        redis_url = redis_url.replace(" ", "")
        
        logger.info(f"URL original: {original_url[:50]}...")
        logger.info(f"URL normalizada: {redis_url[:50]}...")
        
        # Parsear URL manualmente conforme documentação do Upstash
        # Upstash requer apenas: host, port, password, ssl=True (SEM username)
        try:
            parsed = urlparse(redis_url)
            
            # Extrair componentes da URL
            hostname = parsed.hostname
            port = parsed.port or 6379
            password = parsed.password
            use_ssl = redis_url.startswith("rediss://")
            
            # Se password não foi extraído pelo urlparse, extrair manualmente
            # Isso pode acontecer quando há espaços ou caracteres especiais na URL
            if not password and "default:" in redis_url and "@" in redis_url:
                try:
                    # Formato: rediss://default:PASSWORD@HOST:PORT
                    parts = redis_url.split("@")
                    if len(parts) == 2:
                        auth_part = parts[0].replace("rediss://", "").replace("redis://", "")
                        if "default:" in auth_part:
                            password = auth_part.split("default:")[1]
                            logger.info("Password extraído manualmente da URL")
                except Exception as e:
                    logger.warning(f"Erro ao extrair password manualmente: {e}")
            
            # Validar componentes obrigatórios
            if not hostname:
                raise ValueError("URL do Redis sem hostname")
            if use_ssl and not password:
                raise ValueError(f"URL do Redis SSL sem password. URL original: {original_url[:50]}...")
            
            # Log informativo
            logger.info(f"Conectando ao Redis - Host: {hostname}, Port: {port}, SSL: {use_ssl}")
            if password:
                logger.info(f"Password: {'*' * min(len(password), 10)}... (tamanho: {len(password)})")
            else:
                logger.warning("Password não encontrado na URL")
            
            # Criar conexão EXATAMENTE como na documentação do Upstash
            # Usar apenas: host, port, password, ssl=True (SEM username)
            # Documentação: https://upstash.com/docs/redis/howto/connectclient
            self.redis_client = redis.Redis(
                host=hostname,
                port=port,
                password=password,  # Apenas password - SEM username
                ssl=use_ssl,  # True para rediss://
                decode_responses=True,
            )
            logger.info("Cliente Redis criado com sucesso seguindo documentação do Upstash")
            
        except Exception as e:
            logger.error(f"Erro ao criar cliente Redis: {e}")
            logger.error(f"URL original: {original_url[:100]}...")
            logger.error(f"URL normalizada: {redis_url[:100]}...")
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

