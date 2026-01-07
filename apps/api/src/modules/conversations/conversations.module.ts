import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { AuthGuard } from '../../common/guards/auth.guard';

@Module({
  controllers: [ConversationsController],
  providers: [ConversationsService, AuthGuard],
  exports: [ConversationsService],
})
export class ConversationsModule {}

