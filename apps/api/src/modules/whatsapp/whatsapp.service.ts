import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { ConversationsService } from '../conversations/conversations.service';
import { JobsService } from '../jobs/jobs.service';
import { UazapiWebhookDto } from './dto/uazapi-webhook.dto';

@Injectable()
export class WhatsappService {
  constructor(
    private supabase: SupabaseService,
    private conversationsService: ConversationsService,
    private jobsService: JobsService,
  ) {}

  async handleInboundMessage(payload: UazapiWebhookDto) {
    const db = this.supabase.getServiceRoleClient();

    // 1. Resolver empresa_id via whatsapp_instance
    const { data: instance } = await db
      .from('whatsapp_instances')
      .select('empresa_id, instance_id')
      .eq('phone_number', payload.from)
      .single();

    if (!instance) {
      throw new Error('WhatsApp instance not found');
    }

    // 2. Salvar inbound_event
    await db.from('inbound_events').insert({
      empresa_id: instance.empresa_id,
      whatsapp_instance_id: instance.instance_id,
      raw_payload: payload,
      event_type: payload.type || 'message',
      processed: false,
    });

    // 3. Upsert conversation + contact
    const { conversation_id, message_id } =
      await this.conversationsService.upsertConversationAndMessage({
        empresa_id: instance.empresa_id,
        whatsapp_instance_id: instance.instance_id,
        whatsapp_number: payload.from,
        whatsapp_message_id: payload.id || payload.messageId,
        content: payload.body || payload.text || '',
        direction: 'inbound',
        role: 'user',
      });

    // 4. Enqueue job com dedupe_key
    await this.jobsService.enqueueProcessMessage({
      empresa_id: instance.empresa_id,
      conversation_id,
      message_id,
      whatsapp_message_id: payload.id || payload.messageId,
    });
  }

  async sendMessage(data: {
    empresa_id: string;
    conversation_id?: string;
    phone_number?: string;
    message: string;
    buttons?: Array<{ id: string; text: string }>;
  }) {
    const db = this.supabase.getServiceRoleClient();

    // Buscar instância
    const { data: instance } = await db
      .from('whatsapp_instances')
      .select('uazapi_token, uazapi_instance_id')
      .eq('empresa_id', data.empresa_id)
      .single();

    if (!instance) {
      throw new Error('WhatsApp instance not found');
    }

    // Se conversation_id fornecido, buscar phone_number
    let phoneNumber = data.phone_number;
    if (!phoneNumber && data.conversation_id) {
      const { data: conversation } = await db
        .from('conversations')
        .select('client_id')
        .eq('conversation_id', data.conversation_id)
        .single();

      if (conversation) {
        const { data: client } = await db
          .from('clients')
          .select('whatsapp_number')
          .eq('client_id', conversation.client_id)
          .single();

        phoneNumber = client?.whatsapp_number;
      }
    }

    if (!phoneNumber) {
      throw new Error('Phone number not found');
    }

    // Enviar via Uazapi
    const uazapiUrl = `https://api.uazapi.com.br/${instance.uazapi_instance_id}/send-text`;
    
    const response = await fetch(uazapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${instance.uazapi_token}`,
      },
      body: JSON.stringify({
        phone: phoneNumber,
        message: data.message,
        buttons: data.buttons,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to send message via Uazapi');
    }

    const result = await response.json();

    // Salvar mensagem outbound
    if (data.conversation_id) {
      await db.from('messages').insert({
        empresa_id: data.empresa_id,
        conversation_id: data.conversation_id,
        whatsapp_message_id: result.id || result.messageId || `outbound_${Date.now()}`,
        direction: 'outbound',
        role: 'assistant',
        content: data.message,
      });
    }

    return result;
  }
}

