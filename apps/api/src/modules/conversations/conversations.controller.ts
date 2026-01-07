import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { ConversationsService, ConversationStatus } from './conversations.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('conversations')
@UseGuards(AuthGuard)
export class ConversationsController {
  private readonly logger = new Logger(ConversationsController.name);

  constructor(private readonly conversationsService: ConversationsService) {}

  /**
   * Lista conversations da empresa
   * GET /conversations?status=pending_human&limit=20
   */
  @Get()
  async listConversations(
    @CurrentUser() user: any,
    @Query('status') status?: ConversationStatus,
    @Query('needs_human') needsHuman?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const empresaId = user.empresa_id;

    const conversations = await this.conversationsService.listConversations(empresaId, {
      status,
      needsHuman: needsHuman === 'true' ? true : needsHuman === 'false' ? false : undefined,
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    return conversations;
  }

  /**
   * Busca estatísticas de conversations por status
   * GET /conversations/stats
   */
  @Get('stats')
  async getStats(@CurrentUser() user: any) {
    const empresaId = user.empresa_id;
    const counts = await this.conversationsService.countByStatus(empresaId);
    return counts;
  }

  /**
   * Busca uma conversation específica com mensagens
   * GET /conversations/:id
   */
  @Get(':id')
  async getConversation(
    @CurrentUser() user: any,
    @Param('id') conversationId: string,
  ) {
    const empresaId = user.empresa_id;
    const conversation = await this.conversationsService.getConversationWithMessages(
      conversationId,
      empresaId,
    );

    if (!conversation) {
      return { error: 'Conversation not found', statusCode: 404 };
    }

    return conversation;
  }

  /**
   * Atualiza o status de uma conversation
   * PATCH /conversations/:id/status
   */
  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: any,
    @Param('id') conversationId: string,
    @Body() body: { status: ConversationStatus },
  ) {
    const empresaId = user.empresa_id;

    const validStatuses: ConversationStatus[] = ['active', 'closed', 'pending_human', 'with_human'];
    if (!validStatuses.includes(body.status)) {
      return {
        error: `Status inválido. Use: ${validStatuses.join(', ')}`,
        statusCode: 400,
      };
    }

    const updated = await this.conversationsService.updateConversationStatus(
      conversationId,
      empresaId,
      body.status,
    );

    this.logger.log(`Conversation ${conversationId} atualizada para ${body.status} por ${user.id}`);

    return updated;
  }

  /**
   * Marca conversation como "em atendimento humano"
   * POST /conversations/:id/take
   */
  @Post(':id/take')
  async takeConversation(
    @CurrentUser() user: any,
    @Param('id') conversationId: string,
  ) {
    const empresaId = user.empresa_id;

    const updated = await this.conversationsService.updateConversationStatus(
      conversationId,
      empresaId,
      'with_human',
    );

    this.logger.log(`Conversation ${conversationId} assumida por ${user.id}`);

    return {
      success: true,
      conversation: updated,
      message: 'Você assumiu esta conversa',
    };
  }

  /**
   * Fecha uma conversation
   * POST /conversations/:id/close
   */
  @Post(':id/close')
  async closeConversation(
    @CurrentUser() user: any,
    @Param('id') conversationId: string,
  ) {
    const empresaId = user.empresa_id;

    const updated = await this.conversationsService.updateConversationStatus(
      conversationId,
      empresaId,
      'closed',
    );

    this.logger.log(`Conversation ${conversationId} fechada por ${user.id}`);

    return {
      success: true,
      conversation: updated,
      message: 'Conversa fechada com sucesso',
    };
  }

  /**
   * Devolve conversation para o agente (status active)
   * POST /conversations/:id/return-to-agent
   */
  @Post(':id/return-to-agent')
  async returnToAgent(
    @CurrentUser() user: any,
    @Param('id') conversationId: string,
  ) {
    const empresaId = user.empresa_id;

    const updated = await this.conversationsService.updateConversationStatus(
      conversationId,
      empresaId,
      'active',
    );

    this.logger.log(`Conversation ${conversationId} devolvida ao agente por ${user.id}`);

    return {
      success: true,
      conversation: updated,
      message: 'Conversa devolvida ao agente',
    };
  }
}
