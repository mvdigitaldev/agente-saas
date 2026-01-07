import { Injectable } from '@nestjs/common';
import { ConversationsService } from '../../../conversations/conversations.service';
import { ToolContext } from '../tool.interface';

@Injectable()
export class HumanTools {
  constructor(private readonly conversationsService: ConversationsService) {}

  async requestHumanHandoff(args: any, context: ToolContext) {
    const { reason } = args;

    // Usar o método requestHumanHandoff que já atualiza status para pending_human
    const result = await this.conversationsService.requestHumanHandoff({
      empresa_id: context.empresa_id,
      conversation_id: context.conversation_id,
      reason,
    });

    return {
      success: result.success,
      message: 'Solicitação de atendimento humano registrada. Um atendente entrará em contato em breve.',
      reason,
      conversation_id: context.conversation_id,
      status: result.status,
    };
  }
}

