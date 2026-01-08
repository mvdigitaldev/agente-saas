import { Module } from '@nestjs/common';
import { SchedulingController } from './scheduling.controller';
import { SchedulingService } from './scheduling.service';
import { ToolsController } from './tools.controller';
import { ConversationsModule } from '../conversations/conversations.module';

import { SchedulingToolsService } from './scheduling-tools.service';

@Module({
  imports: [ConversationsModule],
  controllers: [SchedulingController, ToolsController],
  providers: [SchedulingService, SchedulingToolsService],
  exports: [SchedulingService, SchedulingToolsService],
})
export class SchedulingModule { }

