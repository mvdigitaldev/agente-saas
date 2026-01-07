import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AgentService } from './agent.service';
import { AgentProcessor } from './agent.processor';
import { LlmService } from './llm/llm.service';
import { ToolRegistry } from './tools/tool.registry';
import { ToolExecutorService } from './tools/tool-executor.service';
import { ToolsRegistrationService } from './tools/tools-registration.service';
import { PromptBuilderService } from './prompt/prompt-builder.service';
import { SchedulingTools } from './tools/handlers/scheduling.tools';
import { InfoTools } from './tools/handlers/info.tools';
import { PaymentTools } from './tools/handlers/payment.tools';
import { HumanTools } from './tools/handlers/human.tools';
import { MediaTools } from './tools/handlers/media.tools';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { AgentConfigModule } from '../agent-config/agent-config.module';
import { JobsModule } from '../jobs/jobs.module';
import { getRedisConnection } from '../../config/redis.config';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'process-inbound-message',
      connection: getRedisConnection(),
    }),
    SchedulingModule,
    ConversationsModule,
    WhatsappModule,
    AgentConfigModule,
    JobsModule,
  ],
  providers: [
    AgentService,
    AgentProcessor,
    LlmService,
    ToolRegistry,
    ToolExecutorService,
    ToolsRegistrationService,
    PromptBuilderService,
    SchedulingTools,
    InfoTools,
    PaymentTools,
    HumanTools,
    MediaTools,
  ],
  exports: [AgentService],
})
export class AgentModule {}

