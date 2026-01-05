import { Module } from '@nestjs/common';
import { SchedulingController } from './scheduling.controller';
import { SchedulingService } from './scheduling.service';
import { ToolsController } from './tools.controller';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [ConversationsModule],
  controllers: [SchedulingController, ToolsController],
  providers: [SchedulingService],
  exports: [SchedulingService],
})
export class SchedulingModule {}

