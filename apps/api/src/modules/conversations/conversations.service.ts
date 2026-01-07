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

    // Upsert client
    const { data: client, error: clientError } = await db
      .from('clients')
      .upsert(
        {
          empresa_id: data.empresa_id,
          whatsapp_number: data.whatsapp_number,
        },
        {
          onConflict: 'empresa_id,whatsapp_number',
        },
      )
      .select('client_id')
      .single();

    if (clientError || !client) {
      this.logger.error('Erro ao upsert client:', clientError);
      throw new Error(`Erro ao criar/atualizar cliente: ${clientError?.message || 'cliente não retornado'}`);
    }

    this.logger.log('Client upsertado:', { client_id: client.client_id });

    // Upsert conversation
    const { data: conversation, error: conversationError } = await db
      .from('conversations')
      .upsert(
        {
          empresa_id: data.empresa_id,
          client_id: client.client_id,
          whatsapp_instance_id: data.whatsapp_instance_id,
          status: 'active',
          last_message_at: new Date().toISOString(),
        },
        {
          onConflict: 'empresa_id,client_id',
        },
      )
      .select('conversation_id')
      .single();

    if (conversationError || !conversation) {
      this.logger.error('Erro ao upsert conversation:', conversationError);
      throw new Error(`Erro ao criar/atualizar conversa: ${conversationError?.message || 'conversa não retornada'}`);
    }

    this.logger.log('Conversation upsertada:', { conversation_id: conversation.conversation_id });

    // Insert message (usar upsert para evitar duplicatas)
    const { data: message, error: messageError } = await db
      .from('messages')
      .upsert(
        {
          empresa_id: data.empresa_id,
          conversation_id: conversation.conversation_id,
          whatsapp_message_id: data.whatsapp_message_id,
          direction: data.direction,
          role: data.role,
          content: data.content,
        },
        {
          onConflict: 'whatsapp_message_id',
          ignoreDuplicates: false,
        },
      )
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

