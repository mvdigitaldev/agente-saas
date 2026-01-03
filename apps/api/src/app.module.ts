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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        ...(process.env.REDIS_URL && {
          // Upstash Redis URL format
          url: process.env.REDIS_URL,
        }),
      },
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
  ],
})
export class AppModule {}

