import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmpresasModule } from './modules/empresas/empresas.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { AgentConfigModule } from './modules/agent-config/agent-config.module';
import { ClientsModule } from './modules/clients/clients.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { CrmModule } from './modules/crm/crm.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { ServicesModule } from './modules/services/services.module';
import { StorageModule } from './modules/storage/storage.module';
import { HealthController } from './health/health.controller';
import { getRedisConnection } from './config/redis.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRoot({
      connection: getRedisConnection(), // Instância do ioredis ou URL string
    }),
    DatabaseModule,
    AuthModule,
    EmpresasModule,
    WhatsappModule,
    ConversationsModule,
    AgentConfigModule,
    ClientsModule,
    SchedulingModule,
    PaymentsModule,
    CrmModule,
    MetricsModule,
    JobsModule,
    ServicesModule,
    StorageModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

