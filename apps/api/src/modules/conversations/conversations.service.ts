import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

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
    const { data: updated } = await db
      .from('conversations')
      .update({
        needs_human: true,
        human_handoff_reason: data.reason || null,
        human_handoff_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('conversation_id', data.conversation_id)
      .eq('empresa_id', data.empresa_id)
      .select()
      .single();

    // TODO: Notificar equipe (webhook, email, etc.)

    return {
      success: true,
      conversation_id: updated.conversation_id,
      needs_human: updated.needs_human,
    };
  }
}

