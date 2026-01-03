import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

@Injectable()
export class ConversationsService {
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

    // Upsert client
    const { data: client } = await db
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

    // Upsert conversation
    const { data: conversation } = await db
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

    // Insert message (com unique constraint para idempotência)
    const { data: message } = await db
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

    return {
      conversation_id: conversation.conversation_id,
      message_id: message.message_id,
    };
  }
}

