"""API HTTP para processar jobs do agente"""
from fastapi import APIRouter, HTTPException
from app.models.schemas import AgentJob
from app.agent.core.agent_runner import AgentRunner
from app.utils.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()
runner = AgentRunner()


@router.post("/process")
async def process_job(job: AgentJob):
    """
    Processa um job do agente.
    
    Recebe um AgentJob e delega para AgentRunner.handle()
    """
    try:
        logger.info(
            f"📥 Job recebido via HTTP: {job.job_id}",
            extra={
                "job_id": job.job_id,
                "company_id": job.company_id,
                "conversation_id": job.conversation_id,
            }
        )
        
        await runner.handle(job)
        
        logger.info(
            f"✅ Job processado com sucesso: {job.job_id}",
            extra={"job_id": job.job_id}
        )
        
        return {"status": "ok", "job_id": job.job_id}
    
    except Exception as e:
        logger.error(
            f"❌ Erro ao processar job: {e}",
            exc_info=True,
            extra={"job_id": job.job_id if hasattr(job, 'job_id') else 'unknown'}
        )
        raise HTTPException(status_code=500, detail=f"Erro ao processar job: {str(e)}")


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "agent"}

