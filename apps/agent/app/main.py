import asyncio
import os
from app.workers.queue_consumer import QueueConsumer

async def main():
    consumer = QueueConsumer()
    await consumer.start()

if __name__ == "__main__":
    asyncio.run(main())

