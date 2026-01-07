import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsService } from './jobs.service';
import { ConversationCleanupJob } from './conversation-cleanup.job';
import { ConversationsModule } from '../conversations/conversations.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getRedisConnection } from '../../config/redis.config';

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: 'process-inbound-message',
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: getRedisConnection(configService.get<string>('REDIS_URL')),
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueueAsync({
      name: 'schedule-confirmations',
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: getRedisConnection(configService.get<string>('REDIS_URL')),
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueueAsync({
      name: 'send-reminders',
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: getRedisConnection(configService.get<string>('REDIS_URL')),
      }),
      inject: [ConfigService],
    }),
    ConversationsModule,
  ],
  providers: [JobsService, ConversationCleanupJob],
  exports: [JobsService],
})
export class JobsModule { }

