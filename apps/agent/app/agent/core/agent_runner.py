"""AgentRunner - Orquestrador principal do agente"""
from app.models.schemas import AgentJob
from app.agent.memory.short_term import ShortTermMemory
from app.agent.memory.long_term import LongTermMemory
from app.agent.prompt.prompt_builder import PromptBuilder
from app.agent.llm.llm_client import LLMClient
from app.agent.clients.nest_client import NestClient
from app.utils.logging import get_logger

logger = get_logger(__name__)


class AgentRunner:
    """
    Orquestrador principal do agente.
    """

    def __init__(self):
        self.short_term_memory = ShortTermMemory()
        self.long_term_memory = LongTermMemory()
        self.prompt_builder = PromptBuilder()
        self.llm_client = LLMClient()
        self.nest_client = NestClient()

    async def handle(self, job: AgentJob):
        log_context = {
            "job_id": job.job_id,
            "company_id": job.company_id,
            "conversation_id": job.conversation_id,
            "channel": job.channel,
        }

        try:
            logger.info("🤖 Início do processamento", extra=log_context)

            # 0. Idempotência
            if await self.short_term_memory.is_job_processed(job.job_id):
                logger.warning("Job já processado, ignorando duplicata", extra=log_context)
                return

            # 1. Persistir mensagem do usuário (ÚNICA vez)
            await self.short_term_memory.append(
                company_id=job.company_id,
                conversation_id=job.conversation_id,
                role="user",
                content=job.message,
            )

            await self.long_term_memory.save_message(
                company_id=job.company_id,
                conversation_id=job.conversation_id,
                role="user",
                content=job.message,
            )

            await self.short_term_memory.mark_job_processed(job.job_id)

            # 2. Carregar contexto
            st_messages = await self.short_term_memory.get_context(
                company_id=job.company_id,
                conversation_id=job.conversation_id,
            )

            summary = await self.long_term_memory.load_summary(
                company_id=job.company_id,
                conversation_id=job.conversation_id,
            )

            preferences = await self.long_term_memory.load_preferences(
                company_id=job.company_id,
                conversation_id=job.conversation_id,
            )

            # 3. Construir prompt (SEM criar mensagens)
            messages = self.prompt_builder.build(
                st_messages=st_messages,
                summary=summary,
                preferences=preferences,
            )

            logger.info(
                f"🧠 Prompt montado com {len(messages)} mensagens",
                extra=log_context,
            )

            # 4. Executar LLM
            response = await self.llm_client.generate_response(messages)
            response_content = response.content or ""

            logger.info(
                f"🗣️ Resposta LLM gerada (tokens: {response.usage.get('total_tokens') if response.usage else '?'})",
                extra=log_context,
            )

            # 5. Persistir + enviar resposta
            if response_content:
                await self.short_term_memory.append(
                    company_id=job.company_id,
                    conversation_id=job.conversation_id,
                    role="assistant",
                    content=response_content,
                )

                await self.long_term_memory.save_message(
                    company_id=job.company_id,
                    conversation_id=job.conversation_id,
                    role="assistant",
                    content=response_content,
                )

                await self.nest_client.send_message(
                    company_id=job.company_id,
                    conversation_id=job.conversation_id,
                    content=response_content,
                )

            # 6. Gatilho de resumo
            msg_count = await self.short_term_memory.count_messages(
                company_id=job.company_id,
                conversation_id=job.conversation_id,
            )

            if msg_count > 10:
                logger.info(
                    f"Gatilho de resumo acionado (count={msg_count})",
                    extra=log_context,
                )
                # await self.summarizer.update(...)

            logger.info("✅ Job concluído com sucesso", extra=log_context)

        except Exception as e:
            logger.error(
                f"❌ Erro fatal no AgentRunner: {e}",
                exc_info=True,
                extra=log_context,
            )
            raise
