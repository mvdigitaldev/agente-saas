import { Module } from '@nestjs/common';
import { WhatsappController, WhatsappSendController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { UazapiService } from './uazapi.service';
import { ConversationsModule } from '../conversations/conversations.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [ConversationsModule, JobsModule],
  controllers: [WhatsappController, WhatsappSendController],
  providers: [WhatsappService, UazapiService],
  exports: [WhatsappService, UazapiService],
})
export class WhatsappModule {}

