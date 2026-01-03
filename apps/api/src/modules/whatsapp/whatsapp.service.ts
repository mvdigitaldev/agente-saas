import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { ConversationsService } from '../conversations/conversations.service';
import { JobsService } from '../jobs/jobs.service';
import { UazapiService } from './uazapi.service';
import { UazapiWebhookDto } from './dto/uazapi-webhook.dto';
import { CreateInstanceDto } from './dto/create-instance.dto';

@Injectable()
export class WhatsappService {
  constructor(
    private supabase: SupabaseService,
    private conversationsService: ConversationsService,
    private jobsService: JobsService,
    private uazapiService: UazapiService,
  ) {}

  async handleInboundMessage(payload: UazapiWebhookDto, instanceIdFromQuery?: string) {
    const db = this.supabase.getServiceRoleClient();

    try {
      // 1. Identificar empresa por instance_id (prioridade: query param > payload > phone_number)
      let instance = null;

      // Tentar por instance_id do query param
      if (instanceIdFromQuery) {
        const { data, error } = await db
          .from('whatsapp_instances')
          .select('empresa_id, instance_id, uazapi_instance_id')
          .eq('uazapi_instance_id', instanceIdFromQuery)
          .single();
        
        if (!error && data) {
          instance = data;
        }
      }

      // Tentar por instance_id no payload (se Uazapi enviar)
      if (!instance && payload.instance_id) {
        const { data, error } = await db
          .from('whatsapp_instances')
          .select('empresa_id, instance_id, uazapi_instance_id')
          .eq('uazapi_instance_id', payload.instance_id)
          .single();
        
        if (!error && data) {
          instance = data;
        }
      }

      // Fallback: tentar por phone_number (from)
      if (!instance && payload.from) {
        const { data, error } = await db
          .from('whatsapp_instances')
          .select('empresa_id, instance_id, uazapi_instance_id')
          .eq('phone_number', payload.from)
          .single();
        
        if (!error && data) {
          instance = data;
        }
      }

      if (!instance) {
        console.error('WhatsApp instance not found', { 
          instanceIdFromQuery, 
          payloadFrom: payload.from,
          payloadInstanceId: payload.instance_id 
        });
        // Não lançar erro para não quebrar o webhook, apenas logar
        return;
      }

      // 2. Salvar inbound_event
      try {
        await db.from('inbound_events').insert({
          empresa_id: instance.empresa_id,
          whatsapp_instance_id: instance.instance_id,
          raw_payload: payload,
          event_type: payload.type || 'message',
          processed: false,
        });
      } catch (error) {
        console.error('Erro ao salvar inbound_event:', error);
      }

      // 3. Upsert conversation + contact
      try {
        const { conversation_id, message_id } =
          await this.conversationsService.upsertConversationAndMessage({
            empresa_id: instance.empresa_id,
            whatsapp_instance_id: instance.instance_id,
            whatsapp_number: payload.from,
            whatsapp_message_id: payload.id || payload.messageId || `inbound_${Date.now()}`,
            content: payload.body || payload.text || '',
            direction: 'inbound',
            role: 'user',
          });

        // 4. Enqueue job com dedupe_key
        try {
          await this.jobsService.enqueueProcessMessage({
            empresa_id: instance.empresa_id,
            conversation_id,
            message_id,
            whatsapp_message_id: payload.id || payload.messageId || `inbound_${Date.now()}`,
          });
        } catch (error) {
          console.error('Erro ao enfileirar job:', error);
        }
      } catch (error) {
        console.error('Erro ao processar conversa:', error);
      }
    } catch (error) {
      console.error('Erro geral no handleInboundMessage:', error);
      // Não lançar erro para não quebrar o webhook
    }
  }

  async createInstance(dto: CreateInstanceDto) {
    const db = this.supabase.getServiceRoleClient();

    // Verificar se já existe instância para esta empresa
    const { data: existing } = await db
      .from('whatsapp_instances')
      .select('*')
      .eq('empresa_id', dto.empresa_id)
      .single();

    if (existing) {
      throw new BadRequestException('Empresa já possui uma instância WhatsApp');
    }

    // Gerar nome da instância
    const instanceName = dto.instance_name || `empresa_${dto.empresa_id.substring(0, 8)}`;

    // Criar instância na Uazapi
    const uazapiInstance = await this.uazapiService.createInstance(instanceName);

    // Salvar no banco
    const { data: instance } = await db
      .from('whatsapp_instances')
      .insert({
        empresa_id: dto.empresa_id,
        uazapi_instance_id: uazapiInstance.instance_id,
        uazapi_token: uazapiInstance.apikey,
        uazapi_apikey: uazapiInstance.apikey,
        status: 'disconnected',
      })
      .select()
      .single();

    // Buscar QR code
    let qrcode = null;
    try {
      qrcode = await this.uazapiService.getQrCode(uazapiInstance.instance_id, uazapiInstance.apikey);
    } catch (error) {
      console.error('Erro ao buscar QR code inicial:', error);
    }

    return {
      ...instance,
      qrcode,
    };
  }

  async getQrCode(instanceId: string, empresaId: string) {
    const db = this.supabase.getServiceRoleClient();

    // Buscar instância e validar que pertence à empresa
    const { data: instance } = await db
      .from('whatsapp_instances')
      .select('uazapi_instance_id, uazapi_apikey, empresa_id')
      .eq('instance_id', instanceId)
      .eq('empresa_id', empresaId)
      .single();

    if (!instance) {
      throw new NotFoundException('Instância não encontrada');
    }

    // Buscar QR code
    const qrcode = await this.uazapiService.getQrCode(
      instance.uazapi_instance_id,
      instance.uazapi_apikey,
    );

    return { qrcode };
  }

  async getInstanceStatus(instanceId: string, empresaId: string) {
    const db = this.supabase.getServiceRoleClient();

    // Buscar instância e validar que pertence à empresa
    const { data: instance } = await db
      .from('whatsapp_instances')
      .select('uazapi_instance_id, uazapi_apikey, empresa_id, phone_number')
      .eq('instance_id', instanceId)
      .eq('empresa_id', empresaId)
      .single();

    if (!instance) {
      throw new NotFoundException('Instância não encontrada');
    }

    // Verificar status na Uazapi
    const status = await this.uazapiService.getInstanceStatus(
      instance.uazapi_instance_id,
      instance.uazapi_apikey,
    );

    // Se conectado e ainda não tem phone_number salvo, atualizar
    if (status.connected && status.phone && !instance.phone_number) {
      const webhookUrl = this.uazapiService.generateWebhookUrl(instance.uazapi_instance_id);
      
      // Configurar webhook automaticamente
      try {
        await this.uazapiService.setWebhook(
          instance.uazapi_instance_id,
          instance.uazapi_apikey,
          webhookUrl,
        );
      } catch (error) {
        console.error('Erro ao configurar webhook:', error);
      }

      // Atualizar instância no banco
      await db
        .from('whatsapp_instances')
        .update({
          status: 'connected',
          phone_number: status.phone,
          webhook_url: webhookUrl,
          last_sync_at: new Date().toISOString(),
        })
        .eq('instance_id', instanceId);
    } else if (status.connected) {
      // Apenas atualizar status
      await db
        .from('whatsapp_instances')
        .update({
          status: 'connected',
          last_sync_at: new Date().toISOString(),
        })
        .eq('instance_id', instanceId);
    }

    return status;
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
      .select('uazapi_instance_id, uazapi_apikey')
      .eq('empresa_id', data.empresa_id)
      .single();

    if (!instance) {
      throw new NotFoundException('WhatsApp instance not found');
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
      throw new BadRequestException('Phone number not found');
    }

    // Enviar via Uazapi usando o serviço
    const result = await this.uazapiService.sendMessage(
      instance.uazapi_instance_id,
      instance.uazapi_apikey,
      phoneNumber,
      data.message,
      data.buttons,
    );

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

