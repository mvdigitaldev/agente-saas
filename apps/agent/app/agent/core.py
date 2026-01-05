import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from memory.context_loader import ContextLoader
from memory.summary_writer import SummaryWriter
from memory.vector_store import VectorStore
from agent.policy import PolicyEngine
from agent.router import Router
from tools.nest_client import NestClient
from tools import register_all_tools
from utils.logging import get_logger

logger = get_logger(__name__)

class AgentCore:
    def __init__(self):
        # Registrar todas as tools no registry
        register_all_tools()
        logger.info("All tools registered")
        
        self.context_loader = ContextLoader()
        self.summary_writer = SummaryWriter()
        self.vector_store = VectorStore()
        self.policy_engine = PolicyEngine()
        self.router = Router()
        self.nest_client = NestClient()

    async def process_message(self, data: dict):
        empresa_id = data["empresa_id"]
        conversation_id = data["conversation_id"]
        message_id = data["message_id"]

        logger.info(f"Processing message for empresa {empresa_id}, conversation {conversation_id}")

        # 1. Load empresa config
        config = self.policy_engine.load_empresa_config(empresa_id)
        features = self.policy_engine.load_empresa_features(empresa_id)

        # 2. Load ST memory (últimas 20 mensagens)
        st_memory = self.context_loader.load_short_term(conversation_id, limit=20)

        # 3. Load summary
        summary = self.context_loader.load_summary(conversation_id)

        # 4. Vector search (LT memory)
        client_id = self.context_loader.get_client_id(conversation_id)
        query_text = st_memory[-1]["content"] if st_memory else ""
        lt_memory = self.vector_store.search(
            empresa_id=empresa_id,
            client_id=client_id,
            query_text=query_text,
            limit=5,
        )

        # 5. LLM reasoning + tool calling
        response = await self.router.process(
            empresa_id=empresa_id,
            conversation_id=conversation_id,
            config=config,
            features=features,
            st_memory=st_memory,
            summary=summary,
            lt_memory=lt_memory,
            nest_client=self.nest_client,
        )

        # 6. Save assistant message
        self.context_loader.save_message(
            conversation_id=conversation_id,
            content=response["content"],
            role="assistant",
            direction="outbound",
        )

        # 7. Update memory (summary + facts)
        self.summary_writer.update_summary_if_needed(conversation_id, st_memory)
        self.vector_store.extract_and_store_facts(
            empresa_id=empresa_id,
            client_id=client_id,
            conversation_id=conversation_id,
            messages=st_memory,
        )

        # 8. Send response via Nest
        await self.nest_client.send_message({
            "empresa_id": empresa_id,
            "conversation_id": conversation_id,
            "message": response["content"],
            "buttons": response.get("buttons"),
        })

        logger.info("Message processed successfully")

