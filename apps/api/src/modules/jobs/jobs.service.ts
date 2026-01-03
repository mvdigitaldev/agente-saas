import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class JobsService {
  constructor(
    @InjectQueue('process-inbound-message')
    private processMessageQueue: Queue,
  ) {}

  async enqueueProcessMessage(data: {
    empresa_id: string;
    conversation_id: string;
    message_id: string;
    whatsapp_message_id: string;
  }) {
    // Usa whatsapp_message_id como jobId para idempotência
    await this.processMessageQueue.add(
      'process',
      data,
      {
        jobId: data.whatsapp_message_id,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );
  }
}

