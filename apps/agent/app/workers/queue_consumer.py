class QueueConsumer:
    def __init__(self):
        self.redis_url = os.getenv("REDIS_URL")
        if not self.redis_url:
            raise RuntimeError("REDIS_URL não definida")

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
                logger.error(f"Error processing job: {e}")
                await asyncio.sleep(1)
