"""AgentRunner - Orquestrador principal do agente"""
from app.models.schemas import AgentJob
from app.agent.memory.short_term import ShortTermMemory
from app.agent.memory.long_term import LongTermMemory
from app.utils.logging import get_logger

logger = get_logger(__name__)


class AgentRunner:
    """
    Orquestrador principal do agente.
    Responsável por:
    - Receber AgentJob
    - Carregar memória (curta + longa)
    - Montar prompt
    - Chamar LLM
    - Decidir tool
    - Executar tool
    - Salvar resposta na memória
    """
    
    def __init__(self):
        self.short_term_memory = ShortTermMemory()
        self.long_term_memory = LongTermMemory()
    
    async def handle(self, job: AgentJob):
        """
        Processa um job do agente.
        
        Args:
            job: AgentJob validado
        """
        logger.info(
            f"🤖 AgentRunner processando job: {job.job_id} "
            f"(company: {job.company_id}, conversation: {job.conversation_id})"
        )
        
        logger.info(f"📝 Mensagem: {job.message[:100]}...")
        logger.info(f"📱 Canal: {job.channel}")
        logger.info(f"🕐 Criado em: {job.created_at}")
        
        # Fase 4: carregar memória curta (Redis)
        st_messages = await self.short_term_memory.get_context(
            company_id=job.company_id,
            conversation_id=job.conversation_id
        )
        logger.info(f"💭 Memória curta: {len(st_messages)} mensagens")
        
        # Salvar mensagem do usuário na memória curta
        await self.short_term_memory.append(
            company_id=job.company_id,
            conversation_id=job.conversation_id,
            role="user",
            content=job.message
        )
        
        # Salvar mensagem do usuário na memória longa (persistência)
        await self.long_term_memory.save_message(
            company_id=job.company_id,
            conversation_id=job.conversation_id,
            role="user",
            content=job.message
        )
        
        # Fase 5: carregar memória longa (apenas resumo/preferências/decisões, NUNCA histórico completo)
        summary = await self.long_term_memory.load_summary(
            company_id=job.company_id,
            conversation_id=job.conversation_id
        )
        preferences = await self.long_term_memory.load_preferences(
            company_id=job.company_id,
            conversation_id=job.conversation_id
        )
        decisions = await self.long_term_memory.load_relevant_decisions(
            company_id=job.company_id,
            conversation_id=job.conversation_id
        )
        
        logger.info(f"📚 Memória longa: resumo={summary is not None}, preferências={len(preferences)}, decisões={len(decisions)}")
        
        # TODO Fase 6: montar prompt, chamar LLM, executar tools
        
        logger.info(f"✅ Job {job.job_id} processado (com memória curta e longa)")

