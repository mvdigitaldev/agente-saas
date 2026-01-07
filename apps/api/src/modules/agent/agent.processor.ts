import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { AgentService, AgentJob } from './agent.service';

@Processor('process-inbound-message')
export class AgentProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentProcessor.name);

  constructor(private readonly agentService: AgentService) {
    super();
  }

  async process(job: Job<AgentJob>) {
    const logContext = {
      jobId: job.id,
      job_id: job.data.job_id,
      company_id: job.data.company_id,
      conversation_id: job.data.conversation_id,
    };

    try {
      this.logger.log('📥 Processando job do BullMQ', logContext);

      await this.agentService.processIncomingMessage(job.data);

      this.logger.log('✅ Job processado com sucesso', logContext);
    } catch (error: any) {
      this.logger.error(
        `❌ Erro ao processar job: ${error.message}`,
        error.stack,
        logContext,
      );
      throw error; // Re-throw para BullMQ tentar novamente
    }
  }
}

