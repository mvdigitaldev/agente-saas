import { Injectable, BadRequestException, NotFoundException, Logger, HttpException } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { ConversationsService } from '../conversations/conversations.service';
import { JobsService } from '../jobs/jobs.service';
import { UazapiService } from './uazapi.service';
import { UazapiWebhookDto } from './dto/uazapi-webhook.dto';
import { CreateInstanceDto } from './dto/create-instance.dto';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private supabase: SupabaseService,
    private conversationsService: ConversationsService,
    private jobsService: JobsService,
    private uazapiService: UazapiService,
  ) {}

  /**
   * Sanitiza nome para gerar instance_name único
   */
  private sanitizeInstanceName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
      .replace(/\s+/g, '-') // Espaços para hífen
      .replace(/-+/g, '-') // Múltiplos hífens para um só
      .replace(/^-|-$/g, ''); // Remove hífens no início/fim
  }

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
        this.logger.warn('WhatsApp instance not found', { 
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
        this.logger.error('Erro ao salvar inbound_event:', error);
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
          this.logger.error('Erro ao enfileirar job:', error);
        }
      } catch (error) {
        this.logger.error('Erro ao processar conversa:', error);
      }
    } catch (error) {
      this.logger.error('Erro geral no handleInboundMessage:', error);
      // Não lançar erro para não quebrar o webhook
    }
  }

  /**
   * Cria uma nova conexão WhatsApp para a empresa
   * Fluxo: initInstance → connectInstance → salvar com token e QR code
   */
  async createInstance(dto: CreateInstanceDto) {
    const db = this.supabase.getServiceRoleClient();

    // Verificar se já existe instância para esta empresa
    const { data: existing } = await db
      .from('whatsapp_instances')
      .select('*')
      .eq('empresa_id', dto.empresa_id)
      .single();

    if (existing && existing.status === 'connected') {
      throw new BadRequestException('Empresa já possui uma conexão WhatsApp ativa');
    }

    // Buscar nome da empresa para gerar instance_name
    const { data: empresa } = await db
      .from('empresas')
      .select('nome')
      .eq('empresa_id', dto.empresa_id)
      .single();

    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }

    // Gerar nome da instância sanitizado
    const baseName = this.sanitizeInstanceName(empresa.nome || `empresa-${dto.empresa_id.substring(0, 8)}`);
    let instanceName = baseName;
    let counter = 1;

    // Verificar se já existe instância com esse nome
    while (true) {
      const { data: existingName } = await db
        .from('whatsapp_instances')
        .select('instance_id')
        .eq('instance_name', instanceName)
        .single();

      if (!existingName) {
        break; // Nome único encontrado
      }

      instanceName = `${baseName}-${counter}`;
      counter++;
    }

    // 1. Criar instância no Uazapi (status: disconnected, sem QR code)
    const initResponse = await this.uazapiService.initInstance(instanceName);
    const instanceToken = initResponse.token || initResponse.instance?.token;
    const uazapiInstanceId = initResponse.instance?.id;

    if (!instanceToken) {
      throw new BadRequestException('Token da instância não retornado pelo Uazapi');
    }

    if (!uazapiInstanceId) {
      throw new BadRequestException('ID da instância não retornado pelo Uazapi');
    }

    // 2. Chamar /instance/connect (sem phone) para gerar QR code PRIMEIRO
    // IMPORTANTE: Conectar antes de configurar webhook para evitar problemas de sincronização
    let connectResponse;
    try {
      this.logger.log(`Conectando instância ${instanceName} no Uazapi para gerar QR code`);
      connectResponse = await this.uazapiService.connectInstance(instanceToken);
      this.logger.debug(`Resposta do connect: connected=${connectResponse.connected}, loggedIn=${connectResponse.loggedIn}, qrcode=${connectResponse.instance?.qrcode ? 'presente' : 'ausente'}`);
    } catch (error: any) {
      // Se erro 404/401 (instância não encontrada ou token inválido no Uazapi), limpar e relançar erro
      if (this.uazapiService.isInstanceNotFoundError(error)) {
        this.logger.warn(
          `Instância ${instanceName} não encontrada ou token inválido no Uazapi ao tentar conectar (404/401).`,
        );
        throw new HttpException(
          'Instância não encontrada no Uazapi. Tente criar uma nova conexão.',
          404,
        );
      }
      this.logger.error(`Erro ao conectar instância ${instanceName}: ${error.message}`, error.stack);
      throw error;
    }

    // 3. Configurar webhook APÓS conectar (quando instância está em estado 'connecting' ou 'connected')
    const webhookUrl = this.uazapiService.generateWebhookUrl(uazapiInstanceId);
    try {
      await this.uazapiService.setWebhook(instanceToken, webhookUrl, {
        enabled: true,
        events: ['messages', 'connection'],
        excludeMessages: ['wasSentByApi', 'isGroupYes'],
      });
      this.logger.log(`Webhook configurado após conectar: ${webhookUrl}`);
    } catch (error) {
      this.logger.error('Erro ao configurar webhook após conectar:', error);
      // Não falhar criação se webhook falhar, mas logar o erro
    }

    // Calcular data de expiração (2 minutos a partir de agora)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 2);

    // Determinar status inicial
    const isConnected = connectResponse.connected && connectResponse.loggedIn;
    const initialStatus = isConnected ? 'connected' : 'connecting';

    // 4. Salvar conexão no banco (igual ao iAgenda)
    // Na criação inicial, o número ainda não existe (vem depois quando QR code é escaneado, em status.jid.user via /instance/status)
    const connectionData: any = {
      empresa_id: dto.empresa_id,
      instance_name: instanceName,
      uazapi_instance_id: uazapiInstanceId,
      uazapi_token: instanceToken,
      status: initialStatus,
      phone_number: connectResponse.jid?.user || undefined, // Se já conectado, vem em jid.user (igual ao iAgenda)
      qr_code_url: connectResponse.instance?.qrcode || undefined,
      qr_code_expires_at: expiresAt.toISOString(),
      connected_at: isConnected ? new Date().toISOString() : undefined,
      webhook_url: webhookUrl, // Sempre salvar webhook_url (já configurado acima)
    };

    if (existing) {
      // Atualizar conexão existente
      const { data: updated, error: updateError } = await db
        .from('whatsapp_instances')
        .update(connectionData)
        .eq('instance_id', existing.instance_id)
        .select()
        .single();

      if (updateError) {
        this.logger.error('Erro ao atualizar conexão', updateError);
        throw new BadRequestException('Erro ao atualizar conexão WhatsApp');
      }

      // Webhook já foi configurado na criação, não precisa configurar novamente

      return {
        instance_id: updated.instance_id,
        qrcode: connectResponse.instance?.qrcode || null,
        status: initialStatus,
        connected: isConnected,
        logged_in: connectResponse.loggedIn || false,
        qr_code_expires_at: expiresAt.toISOString(),
      };
    } else {
      // Criar nova conexão
      const { data: created, error: insertError } = await db
        .from('whatsapp_instances')
        .insert(connectionData)
        .select()
        .single();

      if (insertError) {
        this.logger.error('Erro ao criar conexão', insertError);
        throw new BadRequestException('Erro ao criar conexão WhatsApp');
      }

      // Webhook já foi configurado na criação, não precisa configurar novamente

      return {
        instance_id: created.instance_id,
        qrcode: connectResponse.instance?.qrcode || null,
        status: initialStatus,
        connected: isConnected,
        logged_in: connectResponse.loggedIn || false,
        qr_code_expires_at: expiresAt.toISOString(),
      };
    }
  }

  /**
   * Busca QR code atualizado da instância
   */
  async getQrCode(instanceId: string, empresaId: string) {
    const db = this.supabase.getServiceRoleClient();

    // Buscar instância e validar que pertence à empresa
    const { data: instance } = await db
      .from('whatsapp_instances')
      .select('uazapi_instance_id, uazapi_token, empresa_id, status')
      .eq('instance_id', instanceId)
      .eq('empresa_id', empresaId)
      .single();

    if (!instance) {
      throw new NotFoundException('Instância não encontrada');
    }

    if (!instance.uazapi_token) {
      throw new BadRequestException('Token da instância não encontrado');
    }

    // Se status é connecting, buscar QR code atualizado via connect
    if (instance.status === 'connecting') {
      try {
        const connectResponse = await this.uazapiService.connectInstance(instance.uazapi_token);
        return { qrcode: connectResponse.instance?.qrcode || null };
      } catch (error: any) {
        if (this.uazapiService.isInstanceNotFoundError(error)) {
          // Atualizar status para disconnected
          await db
            .from('whatsapp_instances')
            .update({ status: 'disconnected' })
            .eq('instance_id', instanceId);
          throw new NotFoundException('Instância não encontrada no Uazapi');
        }
        throw error;
      }
    }

    // Se já conectado, não há QR code
    return { qrcode: null };
  }

  /**
   * Verifica e atualiza status da conexão
   */
  async getInstanceStatus(instanceId: string, empresaId: string) {
    const db = this.supabase.getServiceRoleClient();

    // Buscar instância e validar que pertence à empresa
    const { data: instance } = await db
      .from('whatsapp_instances')
      .select('uazapi_instance_id, uazapi_token, empresa_id, phone_number, status, connected_at, instance_name, webhook_url')
      .eq('instance_id', instanceId)
      .eq('empresa_id', empresaId)
      .single();

    if (!instance) {
      throw new NotFoundException('Instância não encontrada');
    }

    if (!instance.uazapi_token) {
      throw new BadRequestException('Token da instância não encontrado');
    }

    // Verificar status no Uazapi
    try {
      this.logger.log(`Verificando status da instância ${instance.instance_name || instanceId} no Uazapi`);
      const statusResponse = await this.uazapiService.getInstanceStatus(instance.uazapi_token);
      this.logger.debug(`Resposta do Uazapi: ${JSON.stringify(statusResponse)}`);

      // Verificar status: priorizar status.status (root) se existir, senão usar instance
      const isConnected = statusResponse.status?.connected ?? statusResponse.instance.connected ?? false;
      const isLoggedIn = statusResponse.status?.loggedIn ?? statusResponse.instance.loggedIn ?? false;
      this.logger.log(`Status detectado: connected=${isConnected}, loggedIn=${isLoggedIn}, instance.status=${statusResponse.instance.status}`);
      
      // Determinar status: precisa estar connected E loggedIn para ser "connected"
      const newStatus = 
        statusResponse.instance.status === 'connecting'
          ? 'connecting'
          : isConnected && isLoggedIn
            ? 'connected'
            : 'disconnected';

      // Extrair número de telefone: quando conectado, o número vem em status.jid (pode ser objeto ou string)
      let phoneNumber = instance.phone_number; // Manter existente se não houver novo
      
      if (newStatus === 'connected') {
        const jid = statusResponse.status?.jid;
        
        if (jid) {
          if (typeof jid === 'string') {
            // Se jid é uma string no formato "554197429568:59@s.whatsapp.net"
            // Extrair o número antes dos dois pontos
            const match = jid.match(/^(\d+):/);
            if (match && match[1]) {
              phoneNumber = match[1];
            }
          } else if (typeof jid === 'object' && jid !== null && 'user' in jid) {
            // Se jid é um objeto com propriedade user
            phoneNumber = jid.user;
          }
        }
      }

      // Atualizar status local (igual ao iAgenda)
      const updateData: any = {
        status: newStatus,
        phone_number: phoneNumber || undefined, // Salvar undefined se não houver número (não null)
        qr_code_url: newStatus === 'connecting'
          ? (statusResponse.instance?.qrcode || undefined)
          : undefined, // Limpar QR code quando conectado ou desconectado (undefined, não null)
        connected_at:
          newStatus === 'connected' && !instance.connected_at
            ? new Date().toISOString()
            : instance.connected_at,
        last_sync_at: new Date().toISOString(),
      };

      // Garantir webhook configurado se conectado (backup caso tenha falhado na criação)
      if (newStatus === 'connected' && phoneNumber && !instance.webhook_url) {
        const webhookUrl = this.uazapiService.generateWebhookUrl(instance.uazapi_instance_id);
        updateData.webhook_url = webhookUrl;
        
        try {
          await this.uazapiService.setWebhook(instance.uazapi_token, webhookUrl, {
            enabled: true,
            events: ['messages', 'connection'],
            excludeMessages: ['wasSentByApi', 'isGroupYes'],
          });
          this.logger.log(`Webhook configurado no status update (backup): ${webhookUrl}`);
        } catch (error) {
          this.logger.error('Erro ao configurar webhook no status update:', error);
        }
      } else if (newStatus === 'connected' && phoneNumber) {
        // Atualizar webhook_url no banco mesmo se já estava configurado
        updateData.webhook_url = instance.webhook_url || this.uazapiService.generateWebhookUrl(instance.uazapi_instance_id);
      }

      const { data: updated, error: updateError } = await db
        .from('whatsapp_instances')
        .update(updateData)
        .eq('instance_id', instanceId)
        .select()
        .single();

      if (updateError) {
        this.logger.error(`Erro ao atualizar status no banco: ${updateError.message}`, updateError);
        throw new BadRequestException('Erro ao atualizar status da conexão');
      }

      this.logger.log(`Status atualizado com sucesso: ${newStatus}, phone_number=${phoneNumber || 'null'}`);

      return {
        connected: newStatus === 'connected',
        status: newStatus,
        phone_number: phoneNumber || null,
        qr_code: newStatus === 'connecting' ? (statusResponse.instance?.qrcode || null) : null,
      };
    } catch (error: any) {
      // Se erro 404/401 (instância não encontrada ou token inválido no Uazapi), atualizar status para disconnected
      if (this.uazapiService.isInstanceNotFoundError(error)) {
        this.logger.warn(
          `Instância ${instance.instance_name || instanceId} não encontrada ou token inválido no Uazapi (404/401). Atualizando status para disconnected.`,
        );
        
        const { error: updateError } = await db
          .from('whatsapp_instances')
          .update({
            status: 'disconnected',
            last_sync_at: new Date().toISOString(),
          })
          .eq('instance_id', instanceId);

        if (updateError) {
          this.logger.error(`Erro ao atualizar status para disconnected: ${updateError.message}`, updateError);
        }

        return {
          connected: false,
          status: 'disconnected',
          phone_number: null,
          qr_code: null,
        };
      }

      this.logger.error(`Erro ao verificar status no Uazapi: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Desconecta WhatsApp da empresa
   */
  async disconnect(instanceId: string, empresaId: string) {
    const db = this.supabase.getServiceRoleClient();

    const { data: instance } = await db
      .from('whatsapp_instances')
      .select('uazapi_token, empresa_id')
      .eq('instance_id', instanceId)
      .eq('empresa_id', empresaId)
      .single();

    if (!instance) {
      throw new NotFoundException('Conexão WhatsApp não encontrada');
    }

    if (!instance.uazapi_token) {
      throw new BadRequestException('Token da instância não encontrado');
    }

    try {
      // Desconectar no Uazapi
      await this.uazapiService.disconnectInstance(instance.uazapi_token);
    } catch (error) {
      this.logger.error('Erro ao desconectar no Uazapi', error);
      // Continua para atualizar status local mesmo se falhar no Uazapi
    }

    // Atualizar status local
    await db
      .from('whatsapp_instances')
      .update({
        status: 'disconnected',
        last_sync_at: new Date().toISOString(),
      })
      .eq('instance_id', instanceId);
  }

  /**
   * Deleta instância (usado quando timeout expira ou cancelamento)
   */
  async deleteInstance(instanceId: string, empresaId: string) {
    const db = this.supabase.getServiceRoleClient();

    const { data: instance } = await db
      .from('whatsapp_instances')
      .select('uazapi_token, empresa_id, status')
      .eq('instance_id', instanceId)
      .eq('empresa_id', empresaId)
      .single();

    if (!instance) {
      throw new NotFoundException('Instância não encontrada');
    }

    // Tentar deletar instância no Uazapi (se existir)
    if (instance.uazapi_token) {
      try {
        await this.uazapiService.deleteInstance(instance.uazapi_token);
        this.logger.log(`Instância ${instanceId} deletada no Uazapi`);
      } catch (error: any) {
        // Se erro 404/401 (instância não existe), apenas logar como warning e continuar
        if (this.uazapiService.isInstanceNotFoundError(error)) {
          this.logger.warn(
            `Instância ${instanceId} não existe mais no Uazapi (404/401). Continuando para deletar registro local.`,
          );
        } else {
          this.logger.error(
            `Erro ao deletar instância ${instanceId} no Uazapi: ${error.message}`,
          );
        }
        // Sempre continua para deletar registro local, independente do erro
      }
    }

    // SEMPRE deletar registro local, independente do resultado acima
    const { error: deleteError } = await db
      .from('whatsapp_instances')
      .delete()
      .eq('instance_id', instanceId);

    if (deleteError) {
      this.logger.error('Erro ao deletar conexão local', deleteError);
      throw new BadRequestException('Erro ao deletar instância WhatsApp');
    }

    this.logger.log(`Instância ${instanceId} deletada com sucesso`);
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
      .select('uazapi_instance_id, uazapi_token, status')
      .eq('empresa_id', data.empresa_id)
      .single();

    if (!instance) {
      throw new NotFoundException('WhatsApp instance not found');
    }

    if (instance.status !== 'connected') {
      throw new BadRequestException('WhatsApp não está conectado');
    }

    if (!instance.uazapi_token) {
      throw new BadRequestException('Token da instância não encontrado');
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

    // Formatar telefone (remover caracteres não numéricos, garantir formato 55...)
    const formattedPhone = phoneNumber.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55') && formattedPhone.length >= 10) {
      phoneNumber = '55' + formattedPhone;
    } else {
      phoneNumber = formattedPhone;
    }

    // Enviar via Uazapi usando o serviço (com token, não apikey)
    const result = await this.uazapiService.sendMessage(
      instance.uazapi_token,
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
