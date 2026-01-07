import { Injectable } from '@nestjs/common';
import { ConversationsService } from '../../../conversations/conversations.service';
import { ToolContext } from '../tool.interface';

@Injectable()
export class HumanTools {
  constructor(private readonly conversationsService: ConversationsService) {}

  async requestHumanHandoff(args: any, context: ToolContext) {
    return this.conversationsService.requestHumanHandoff({
      empresa_id: context.empresa_id,
      conversation_id: context.conversation_id,
      reason: args.reason,
    });
  }
}

