import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsService } from './jobs.service';
import { ConversationCleanupJob } from './conversation-cleanup.job';
import { ConversationsModule } from '../conversations/conversations.module';
import { getRedisConnection } from '../../config/redis.config';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'process-inbound-message',
      connection: getRedisConnection(),
    }),
    BullModule.registerQueue({
      name: 'schedule-confirmations',
      connection: getRedisConnection(),
    }),
    BullModule.registerQueue({
      name: 'send-reminders',
      connection: getRedisConnection(),
    }),
    ConversationsModule,
  ],
  providers: [JobsService, ConversationCleanupJob],
  exports: [JobsService],
})
export class JobsModule {}

