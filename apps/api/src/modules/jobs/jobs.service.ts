import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue('process-inbound-message')
    private processMessageQueue: Queue,
  ) { }

  async enqueueProcessMessage(data: {
    empresa_id: string; // Mantendo compatibilidade de nome no argumento, mas mapeando para company_id no payload
    conversation_id: string;
    message_id: string;
    whatsapp_message_id: string;
    message: string;
    channel?: string;
    metadata?: any;
    created_at?: string;
  }) {
    // Constroi payload compatível com AgentJob (Python)
    const payload = {
      job_id: data.whatsapp_message_id, // Idempotency key
      company_id: data.empresa_id,
      conversation_id: data.conversation_id,
      message: data.message,
      channel: data.channel || 'whatsapp',
      created_at: data.created_at || new Date().toISOString(),
      metadata: {
        ...data.metadata,
        message_id: data.message_id,
        whatsapp_message_id: data.whatsapp_message_id,
      },
    };

    // Usa whatsapp_message_id como jobId para idempotência do BullMQ também
    this.logger.log(`📤 Enfileirando job para processamento: ${data.whatsapp_message_id}`);
    this.logger.debug(`   Payload:`, JSON.stringify(payload, null, 2));

    try {
      const job = await this.processMessageQueue.add(
        'process',
        payload,
        {
          jobId: data.whatsapp_message_id,
          removeOnComplete: true, // Limpar jobs completados para economizar Redis
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );

      this.logger.log(`✅ Job enfileirado com sucesso: ${job.id} (${data.whatsapp_message_id})`);
      return job;
    } catch (error: any) {
      this.logger.error(`❌ Erro ao enfileirar job: ${error.message}`, error.stack);
      throw error;
    }
  }
}

