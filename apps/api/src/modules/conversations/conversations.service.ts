import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

export type ConversationStatus = 'active' | 'closed' | 'pending_human' | 'with_human';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(private supabase: SupabaseService) {}

  async upsertConversationAndMessage(data: {
    empresa_id: string;
    whatsapp_instance_id: string;
    whatsapp_number: string;
    whatsapp_message_id: string;
    content: string;
    direction: 'inbound' | 'outbound';
    role: 'user' | 'assistant' | 'system';
  }) {
    const db = this.supabase.getServiceRoleClient();

    this.logger.log('Iniciando upsertConversationAndMessage', {
      empresa_id: data.empresa_id,
      whatsapp_number: data.whatsapp_number,
    });

    // 1. Buscar ou criar client
    let client;
    const { data: existingClient } = await db
      .from('clients')
      .select('client_id')
      .eq('empresa_id', data.empresa_id)
      .eq('whatsapp_number', data.whatsapp_number)
      .single();

    if (existingClient) {
      client = existingClient;
      this.logger.log('Client existente encontrado:', { client_id: client.client_id });
    } else {
      const { data: newClient, error: clientError } = await db
        .from('clients')
        .insert({
          empresa_id: data.empresa_id,
          whatsapp_number: data.whatsapp_number,
        })
        .select('client_id')
        .single();

      if (clientError || !newClient) {
        this.logger.error('Erro ao criar client:', clientError);
        throw new Error(`Erro ao criar cliente: ${clientError?.message || 'cliente não retornado'}`);
      }
      client = newClient;
      this.logger.log('Novo client criado:', { client_id: client.client_id });
    }

    // 2. Buscar ou criar conversation
    let conversation;
    const { data: existingConversation } = await db
      .from('conversations')
      .select('conversation_id')
      .eq('empresa_id', data.empresa_id)
      .eq('client_id', client.client_id)
      .single();

    if (existingConversation) {
      // Atualizar last_message_at
      const { data: updatedConversation, error: updateError } = await db
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          status: 'active',
        })
        .eq('conversation_id', existingConversation.conversation_id)
        .select('conversation_id')
        .single();

      if (updateError) {
        this.logger.error('Erro ao atualizar conversation:', updateError);
      }
      conversation = updatedConversation || existingConversation;
      this.logger.log('Conversation existente atualizada:', { conversation_id: conversation.conversation_id });
    } else {
      const { data: newConversation, error: conversationError } = await db
        .from('conversations')
        .insert({
          empresa_id: data.empresa_id,
          client_id: client.client_id,
          whatsapp_instance_id: data.whatsapp_instance_id,
          status: 'active',
          last_message_at: new Date().toISOString(),
        })
        .select('conversation_id')
        .single();

      if (conversationError || !newConversation) {
        this.logger.error('Erro ao criar conversation:', conversationError);
        throw new Error(`Erro ao criar conversa: ${conversationError?.message || 'conversa não retornada'}`);
      }
      conversation = newConversation;
      this.logger.log('Nova conversation criada:', { conversation_id: conversation.conversation_id });
    }

    // 3. Verificar se mensagem já existe (idempotência)
    const { data: existingMessage } = await db
      .from('messages')
      .select('message_id')
      .eq('whatsapp_message_id', data.whatsapp_message_id)
      .single();

    if (existingMessage) {
      this.logger.log('Mensagem já existe, retornando existente:', { message_id: existingMessage.message_id });
      return {
        conversation_id: conversation.conversation_id,
        message_id: existingMessage.message_id,
      };
    }

    // 4. Inserir nova mensagem
    const { data: message, error: messageError } = await db
      .from('messages')
      .insert({
        empresa_id: data.empresa_id,
        conversation_id: conversation.conversation_id,
        whatsapp_message_id: data.whatsapp_message_id,
        direction: data.direction,
        role: data.role,
        content: data.content,
      })
      .select('message_id')
      .single();

    if (messageError || !message) {
      this.logger.error('Erro ao inserir message:', messageError);
      throw new Error(`Erro ao criar mensagem: ${messageError?.message || 'mensagem não retornada'}`);
    }

    this.logger.log('Message criada:', { message_id: message.message_id });

    return {
      conversation_id: conversation.conversation_id,
      message_id: message.message_id,
    };
  }

  async requestHumanHandoff(data: {
    empresa_id: string;
    conversation_id: string;
    reason?: string;
  }) {
    const db = this.supabase.getServiceRoleClient();

    // Atualizar conversa para marcar como necessitando intervenção humana
    const { data: updated, error } = await db
      .from('conversations')
      .update({
        status: 'pending_human',
        needs_human: true,
        human_handoff_reason: data.reason || null,
        human_handoff_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('conversation_id', data.conversation_id)
      .eq('empresa_id', data.empresa_id)
      .select()
      .single();

    if (error) {
      this.logger.error(`Erro ao solicitar handoff: ${error.message}`);
      throw error;
    }

    // TODO: Notificar equipe (webhook, email, etc.)

    return {
      success: true,
      conversation_id: updated.conversation_id,
      needs_human: updated.needs_human,
      status: updated.status,
    };
  }

  /**
   * Atualiza o status de uma conversation
   */
  async updateConversationStatus(
    conversationId: string,
    empresaId: string,
    status: ConversationStatus,
  ): Promise<any> {
    const db = this.supabase.getServiceRoleClient();

    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    // Se mudou de pending_human para outro status, limpar campos de handoff
    if (status === 'active' || status === 'closed') {
      updateData.needs_human = false;
      updateData.human_handoff_reason = null;
    }

    // Se mudou para with_human, marcar quando começou o atendimento
    if (status === 'with_human') {
      updateData.human_started_at = new Date().toISOString();
    }

    const { data, error } = await db
      .from('conversations')
      .update(updateData)
      .eq('conversation_id', conversationId)
      .eq('empresa_id', empresaId)
      .select()
      .single();

    if (error) {
      this.logger.error(`Erro ao atualizar status da conversation: ${error.message}`);
      throw error;
    }

    this.logger.log(`Conversation ${conversationId} atualizada para status: ${status}`);
    return data;
  }

  /**
   * Lista todas as conversations de uma empresa
   */
  async listConversations(
    empresaId: string,
    filters?: {
      status?: ConversationStatus;
      needsHuman?: boolean;
      limit?: number;
      offset?: number;
    },
  ) {
    const db = this.supabase.getServiceRoleClient();

    let query = db
      .from('conversations')
      .select(`
        conversation_id,
        status,
        needs_human,
        human_handoff_reason,
        human_handoff_requested_at,
        last_message_at,
        created_at,
        updated_at,
        clients:client_id (
          client_id,
          nome,
          whatsapp_number
        )
      `)
      .eq('empresa_id', empresaId)
      .order('last_message_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.needsHuman !== undefined) {
      query = query.eq('needs_human', filters.needsHuman);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Erro ao listar conversations: ${error.message}`);
      throw error;
    }

    return data || [];
  }

  /**
   * Busca uma conversation por ID com mensagens recentes
   */
  async getConversationWithMessages(conversationId: string, empresaId: string) {
    const db = this.supabase.getServiceRoleClient();

    // Buscar conversation
    const { data: conversation, error: convError } = await db
      .from('conversations')
      .select(`
        conversation_id,
        status,
        needs_human,
        human_handoff_reason,
        human_handoff_requested_at,
        last_message_at,
        created_at,
        updated_at,
        clients:client_id (
          client_id,
          nome,
          whatsapp_number
        )
      `)
      .eq('conversation_id', conversationId)
      .eq('empresa_id', empresaId)
      .single();

    if (convError) {
      this.logger.error(`Erro ao buscar conversation: ${convError.message}`);
      return null;
    }

    // Buscar últimas mensagens
    const { data: messages, error: msgError } = await db
      .from('messages')
      .select('message_id, role, content, direction, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(50);

    if (msgError) {
      this.logger.error(`Erro ao buscar messages: ${msgError.message}`);
    }

    return {
      ...conversation,
      messages: messages || [],
    };
  }

  /**
   * Fecha conversations inativas (sem mensagens há X horas)
   */
  async closeInactiveConversations(empresaId: string, hoursInactive: number = 24): Promise<number> {
    const db = this.supabase.getServiceRoleClient();
    const cutoffDate = new Date(Date.now() - hoursInactive * 60 * 60 * 1000).toISOString();

    const { data, error } = await db
      .from('conversations')
      .update({
        status: 'closed',
        updated_at: new Date().toISOString(),
      })
      .eq('empresa_id', empresaId)
      .eq('status', 'active')
      .lt('last_message_at', cutoffDate)
      .select('conversation_id');

    if (error) {
      this.logger.error(`Erro ao fechar conversations inativas: ${error.message}`);
      return 0;
    }

    const count = data?.length || 0;
    if (count > 0) {
      this.logger.log(`${count} conversations fechadas por inatividade`);
    }
    return count;
  }

  /**
   * Conta conversations por status
   */
  async countByStatus(empresaId: string) {
    const db = this.supabase.getServiceRoleClient();

    const { data, error } = await db
      .from('conversations')
      .select('status')
      .eq('empresa_id', empresaId);

    if (error) {
      this.logger.error(`Erro ao contar conversations: ${error.message}`);
      return { active: 0, pending_human: 0, with_human: 0, closed: 0 };
    }

    const counts = {
      active: 0,
      pending_human: 0,
      with_human: 0,
      closed: 0,
    };

    data?.forEach((conv) => {
      if (counts[conv.status as keyof typeof counts] !== undefined) {
        counts[conv.status as keyof typeof counts]++;
      }
    });

    return counts;
  }
}

