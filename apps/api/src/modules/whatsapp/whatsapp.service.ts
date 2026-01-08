import { Injectable, BadRequestException, NotFoundException, Logger, HttpException } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { ConversationsService } from '../conversations/conversations.service';
import { JobsService } from '../jobs/jobs.service';
import { UazapiService } from './uazapi.service';
import { CreateInstanceDto } from './dto/create-instance.dto';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private openai: OpenAI;

  constructor(
    private supabase: SupabaseService,
    private conversationsService: ConversationsService,
    private jobsService: JobsService,
    private uazapiService: UazapiService,
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    } else {
      this.logger.warn('OPENAI_API_KEY não configurada. Funcionalidades de IA (áudio/imagem) podem falhar.');
    }
  }

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

  /**
   * Extrai dados relevantes do payload da Uazapi (formato real)
   * Formato Uazapi: { EventType, message: { chatid, content, text, messageid, sender, senderName, fromMe }, chat, owner }
   * Para áudio/imagem, content pode ser um objeto com {URL, mimetype, fileSHA256, etc}
   */
  private extractMessageData(payload: any): {
    messageId: string;
    from: string;
    body: string;
    senderName: string;
    type: string;
    instanceId?: string;
    isFromMe: boolean;
    owner: string;
    mediaUrl?: string;
    mediaMimetype?: string;
  } | null {
    // Ignorar mensagens enviadas pela API (evitar loop)
    if (payload.message?.wasSentByApi === true || payload.message?.fromMe === true) {
      this.logger.log('Ignorando mensagem enviada pela API ou fromMe=true');
      return null;
    }

    // Formato Uazapi real: { EventType: "messages", message: { ... }, chat: { ... } }
    if (payload.EventType === 'messages' && payload.message) {
      const msg = payload.message;
      const phone = msg.sender?.replace('@s.whatsapp.net', '').replace('@c.us', '') ||
        msg.chatid?.replace('@s.whatsapp.net', '').replace('@c.us', '') || '';

      const messageType = this.detectMessageType(msg, payload.EventType);

      // Para mídia (áudio/imagem/etc), content pode ser objeto com URL
      // Extrair corpo como string e guardar URL separadamente
      let body = '';
      let mediaUrl: string | undefined;
      let mediaMimetype: string | undefined;

      if (typeof msg.content === 'object' && msg.content !== null) {
        // content é objeto de mídia: {URL, mimetype, fileSHA256, fileLength, seconds, PTT, ...}
        mediaUrl = msg.content.URL || msg.URL;
        mediaMimetype = msg.content.mimetype || msg.mimetype;
        body = msg.content.caption || msg.caption || ''; // Legenda da imagem, se houver
        this.logger.log(`📎 Mídia detectada: tipo=${messageType}, url=${mediaUrl ? 'SIM' : 'NÃO'}, mimetype=${mediaMimetype}`);
      } else if (typeof msg.URL === 'string') {
        // URL direto no msg
        mediaUrl = msg.URL;
        mediaMimetype = msg.mimetype;
        body = msg.caption || '';
      } else {
        // Mensagem de texto normal
        body = msg.content || msg.text || '';
      }

      return {
        messageId: msg.messageid || msg.id || `msg_${Date.now()}`,
        from: phone,
        body: body,
        senderName: msg.senderName || payload.chat?.name || payload.chat?.wa_name || '',
        type: messageType,
        instanceId: undefined, // Uazapi não envia instance_id no payload, usamos query param
        isFromMe: msg.fromMe === true,
        owner: payload.owner || '',
        mediaUrl,
        mediaMimetype,
      };
    }

    // Formato alternativo: payload direto com data.key (baileys style)
    if (payload.data?.key?.remoteJid) {
      const remoteJid = payload.data.key.remoteJid;
      const phone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');

      // Extrair mídia do formato baileys
      const msg = payload.data.message;
      let mediaUrl: string | undefined;
      let mediaMimetype: string | undefined;

      if (msg?.imageMessage) {
        mediaUrl = msg.imageMessage.url;
        mediaMimetype = msg.imageMessage.mimetype;
      } else if (msg?.audioMessage) {
        mediaUrl = msg.audioMessage.url;
        mediaMimetype = msg.audioMessage.mimetype;
      }

      return {
        messageId: payload.data.key.id || `msg_${Date.now()}`,
        from: phone,
        body: payload.data.message?.conversation ||
          payload.data.message?.extendedTextMessage?.text ||
          payload.data.message?.imageMessage?.caption ||
          '',
        senderName: payload.data.pushName || '',
        type: payload.event || 'message',
        instanceId: payload.instance,
        isFromMe: payload.data.key.fromMe === true,
        owner: '',
        mediaUrl,
        mediaMimetype,
      };
    }

    // Formato legado: payload com from/body direto
    if (payload.from) {
      return {
        messageId: payload.id || payload.messageId || `msg_${Date.now()}`,
        from: payload.from.replace('@s.whatsapp.net', '').replace('@c.us', ''),
        body: payload.body || payload.text || '',
        senderName: payload.notifyName || payload.senderName || payload.pushName || '',
        type: payload.type || 'message',
        instanceId: payload.instance_id,
        isFromMe: payload.fromMe === true,
        owner: '',
        mediaUrl: payload.mediaUrl,
        mediaMimetype: payload.mimetype,
      };
    }

    // Formato não reconhecido
    return null;
  }

  private detectMessageType(msg: any, defaultType: string): string {
    // 1. Verificar messageType explícito (o campo mais confiável)
    if (msg.messageType) {
      const mt = msg.messageType.toLowerCase();
      if (mt.includes('audio')) return 'audioMessage';
      if (mt.includes('image')) return 'imageMessage';
      if (mt.includes('video')) return 'videoMessage';
      if (mt.includes('document')) return 'documentMessage';
      if (mt.includes('sticker')) return 'stickerMessage';
      // Se não for mídia conhecida, retorna 'message' ou o próprio tipo
      if (mt === 'conversation' || mt === 'extendedtextmessage') return 'message';
      return mt;
    }
    
    // 2. Verificar type direto (ex: ptt = push-to-talk audio, image, audio, video, document)
    if (msg.type) {
      const t = msg.type.toLowerCase();
      if (t === 'ptt' || t === 'audio') return 'audioMessage';
      if (t === 'image') return 'imageMessage';
      if (t === 'video') return 'videoMessage';
      if (t === 'document' || t === 'application') return 'documentMessage';
      if (t === 'sticker') return 'stickerMessage';
      if (t === 'text') return 'message';
    }
    
    // 3. Verificar por mimetype
    if (msg.mimetype) {
      const mime = msg.mimetype.toLowerCase();
      if (mime.includes('audio') || mime.includes('ogg')) return 'audioMessage';
      if (mime.includes('image')) return 'imageMessage';
      if (mime.includes('video')) return 'videoMessage';
      if (mime.includes('application') || mime.includes('pdf')) return 'documentMessage';
    }
    
    // 4. Verificar se content é objeto com mimetype (mídia aninhada)
    if (typeof msg.content === 'object' && msg.content?.mimetype) {
      const mime = msg.content.mimetype.toLowerCase();
      if (mime.includes('audio') || mime.includes('ogg')) return 'audioMessage';
      if (mime.includes('image')) return 'imageMessage';
      if (mime.includes('video')) return 'videoMessage';
    }
    
    // 5. Verificar campo URL (se tem URL provavelmente é mídia) + métricas específicas
    if (msg.URL || msg.content?.URL) {
      if (msg.PTT === true || msg.content?.PTT === true) return 'audioMessage';
      if (msg.seconds || msg.content?.seconds) return 'audioMessage'; // Áudio tem duração em segundos
      
      // Se tiver caption e URL mas não caiu nos anteriores, assumir imagem (comum)
      if (msg.caption || msg.content?.caption) return 'imageMessage';
    }
    
    return defaultType;
  }  async handleInboundMessage(payload: any, instanceIdFromQuery?: string) {
    const db = this.supabase.getServiceRoleClient();

    try {
      // Extrair dados do payload (suporta múltiplos formatos)
      const messageData = this.extractMessageData(payload);

      if (!messageData) {
        this.logger.warn('Payload não reconhecido ou sem dados de mensagem', { payload });
        return; // Não é uma mensagem válida para processar
      }

      // Ignorar mensagens vazias (se não for mídia)
      // Proteção extra: certificar que body é string antes de chamar trim()
      const isBodyEmpty = !messageData.body || (typeof messageData.body === 'string' && messageData.body.trim() === '');
      if (isBodyEmpty && messageData.type === 'message') {
        this.logger.log('Ignorando mensagem vazia');
        return;
      }

      this.logger.log('📨 Dados extraídos do webhook:', messageData);

      // 1. Identificar empresa por instance_id (prioridade: query param > owner do payload)
      let instance = null;

      // Tentar por instance_id do query param
      if (instanceIdFromQuery) {
        const { data, error } = await db
          .from('whatsapp_instances')
          .select('empresa_id, instance_id, uazapi_instance_id, uazapi_token')
          .eq('uazapi_instance_id', instanceIdFromQuery)
          .single();

        if (!error && data) {
          instance = data;
          this.logger.log('Instância encontrada por query param:', { instance_id: data.instance_id });
        }
      }

      // Tentar por owner (número do WhatsApp conectado)
      if (!instance && messageData.owner) {
        const { data, error } = await db
          .from('whatsapp_instances')
          .select('empresa_id, instance_id, uazapi_instance_id, uazapi_token')
          .eq('phone_number', messageData.owner)
          .single();

        if (!error && data) {
          instance = data;
          this.logger.log('Instância encontrada por owner:', { instance_id: data.instance_id });
        }
      }

      if (!instance) {
        this.logger.warn('WhatsApp instance not found', {
          instanceIdFromQuery,
          owner: messageData.owner,
          from: messageData.from,
        });
        return;
      }

      // PROCESSAMENTO DE MÍDIA (SEGUINDO FLUXO DO N8N)
      // Se for áudio ou imagem e tivermos token da instância e OpenAI configurado
      if ((messageData.type === 'audioMessage' || messageData.type === 'imageMessage') && instance.uazapi_token && this.openai) {
        try {
          if (messageData.type === 'audioMessage') {
            // ÁUDIO: Baixar via /message/download com base64 e transcrever com Whisper
            this.logger.log('🎙️ Processando mensagem de áudio...');

            const mediaData = await this.uazapiService.downloadMediaBase64(messageData.messageId, instance.uazapi_token);

            if (!mediaData?.base64Data) {
              throw new Error('Não foi possível baixar o áudio');
            }

            // Converter base64 para Buffer e criar arquivo
            const audioBuffer = Buffer.from(mediaData.base64Data, 'base64');
            const file = await OpenAI.toFile(audioBuffer, 'audio.ogg', { type: 'audio/ogg' });

            // Transcrever com Whisper (igual ao N8N: language: pt)
            const transcription = await this.openai.audio.transcriptions.create({
              file,
              model: 'whisper-1',
              language: 'pt',
            });

            if (transcription.text) {
              messageData.body = transcription.text; // Texto puro da transcrição
              this.logger.log(`✅ Áudio transcrito: "${transcription.text}"`);
            } else {
              messageData.body = '[Áudio sem conteúdo detectável]';
            }

          } else if (messageData.type === 'imageMessage') {
            // IMAGEM: Baixar via /message/download com base64 e analisar com GPT-4o-mini
            this.logger.log('🖼️ Processando mensagem de imagem...');

            const mediaData = await this.uazapiService.downloadMediaBase64(messageData.messageId, instance.uazapi_token);

            if (!mediaData?.base64Data) {
              throw new Error('Não foi possível baixar a imagem');
            }

            // Criar data URL para a imagem
            const mimeType = mediaData.mimetype || 'image/jpeg';
            const dataUrl = `data:${mimeType};base64,${mediaData.base64Data}`;

            // Legenda original (caption)
            const caption = messageData.body || '';

            // Prompt igual ao N8N
            const prompt = `#Instruções
O usuário te enviou uma imagem a qual você deve descrever.

A imagem pode vir acompanhada de uma mensagem de texto (<MensagemUsuario>)

Caso venha, utilize a mensagem anexa como contexto extra, tente capturar o sentimento da mensagem e objetivo pelo qual o usuário esteja enviando esta imagem na conversa.

Crie uma resposta descrevendo as informações enviadas para que estas sejam utilizadas por um agente no futuro.

Lembre-se:
Este agente apenas terá as informações que você fornecer, portanto repasse toda informação que julgar importante.

#Dados
<MensagemUsuario>
${caption}
</MensagemUsuario>`;

            const response = await this.openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: prompt },
                    { type: 'image_url', image_url: { url: dataUrl } },
                  ],
                },
              ],
              max_tokens: 300,
            });

            const description = response.choices[0]?.message?.content || 'Não foi possível analisar a imagem';

            // Formato igual ao N8N (ContextoImagem)
            messageData.body = `<ContextoImagem>

  <DetalheImagem>
${description}
  </DetalheImagem>

Contexto Extra: O usuário encaminhou a mensagem a seguir junto á imagem.
  <MensagemUsuario>
${caption}
  </MensagemUsuario>

</ContextoImagem>`;

            this.logger.log(`✅ Imagem analisada: "${description.substring(0, 50)}..."`);
          }
        } catch (error: any) {
          this.logger.error('Erro ao processar mídia com IA:', error.message || error);
          // Fallback com mensagem de erro
          if (messageData.type === 'audioMessage') {
            messageData.body = '[Erro ao transcrever áudio]';
          } else {
            const caption = messageData.body || '';
            messageData.body = `[Erro ao analisar imagem]${caption ? ` Legenda: ${caption}` : ''}`;
          }
        }
      } else if (messageData.type === 'audioMessage' || messageData.type === 'imageMessage') {
        // Sem OpenAI configurada - usar placeholder
        const caption = messageData.body || '';
        messageData.body = `[Mídia do tipo ${messageData.type} recebida]${caption ? ` Legenda: ${caption}` : ''}`;
      }

      // Garantir que body seja sempre string (proteção extra)
      if (typeof messageData.body !== 'string') {
        this.logger.warn('messageData.body não é string, convertendo:', typeof messageData.body);
        messageData.body = '';
      }

      // Se ainda estiver vazio (ex: imagem sem legenda e falha na IA), preencher para não ser descartado
      if (!messageData.body || messageData.body.trim() === '') {
        messageData.body = `[Mídia do tipo ${messageData.type} recebida]`;
      }

      // 2. Salvar inbound_event
      try {
        await db.from('inbound_events').insert({
          empresa_id: instance.empresa_id,
          whatsapp_instance_id: instance.instance_id,
          raw_payload: payload,
          event_type: messageData.type || 'message',
          processed: false,
        });
      } catch (error) {
        this.logger.error('Erro ao salvar inbound_event:', error);
      }

      // 3. Upsert conversation + contact
      const { conversation_id, message_id } =
        await this.conversationsService.upsertConversationAndMessage({
          empresa_id: instance.empresa_id,
          whatsapp_instance_id: instance.instance_id,
          whatsapp_number: messageData.from,
          whatsapp_message_id: messageData.messageId,
          content: messageData.body,
          direction: 'inbound',
          role: 'user',
          sender_name: messageData.senderName,
        });

      this.logger.log('💬 Conversa criada/atualizada:', { conversation_id, message_id });

      // 4. Enqueue job para processar com IA
      await this.jobsService.enqueueProcessMessage({
        empresa_id: instance.empresa_id,
        conversation_id,
        message_id,
        whatsapp_message_id: messageData.messageId,
        message: messageData.body,
        channel: 'whatsapp',
        created_at: new Date().toISOString(),
        metadata: {
          sender: messageData.from,
          sender_name: messageData.senderName,
          is_group: false,
          raw_payload: payload,
        },
      });

      this.logger.log('🤖 Job enfileirado para processamento IA');

    } catch (error) {
      this.logger.error('Erro ao processar mensagem:', error);
      throw error;
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

    // NOTA: Não salvar mensagem aqui - já foi salva pelo AgentService antes de chamar sendMessage
    // Evita duplicação de mensagens no banco

    return result;
  }

  async sendMedia(data: {
    empresa_id: string;
    conversation_id?: string;
    phone_number?: string;
    url: string;
    media_type?: 'image' | 'video' | 'document';
    caption?: string;
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

    // Enviar mídia via Uazapi
    const result = await this.uazapiService.sendMedia(
      instance.uazapi_token,
      phoneNumber,
      data.url,
      data.media_type || 'image',
      data.caption,
    );

    // NOTA: Não salvar mensagem aqui - deve ser salva pelo chamador se necessário
    // Evita duplicação de mensagens no banco

    return result;
  }

  /**
   * Atualiza o webhook da instância com a URL configurada no .env (WEBHOOK_BASE_URL)
   * Útil para desenvolvimento local (Ngrok) ou correções
   */
  async updateWebhook(instanceId: string, empresaId: string) {
    const db = this.supabase.getServiceRoleClient();

    const { data: instance, error } = await db
      .from('whatsapp_instances')
      .select('instance_id, uazapi_instance_id, uazapi_token')
      .eq('instance_id', instanceId)
      .eq('empresa_id', empresaId)
      .single();

    if (error || !instance) {
      throw new NotFoundException('Instância não encontrada');
    }

    if (!instance.uazapi_instance_id || !instance.uazapi_token) {
      throw new BadRequestException('Instância sem ID ou Token do Uazapi');
    }

    // Gera URL baseada no env WEBHOOK_BASE_URL (pode ser Ngrok ou Prod)
    // O ConfigService já leu o .env, então se estiver configurado para Ngrok, vai gerar URL certa
    const webhookUrl = this.uazapiService.generateWebhookUrl(instance.uazapi_instance_id);

    // Atualiza no Uazapi
    await this.uazapiService.setWebhook(instance.uazapi_token, webhookUrl);

    // Opcional: Atualizar no banco para refletir o estado atual
    await db
      .from('whatsapp_instances')
      .update({ webhook_url: webhookUrl })
      .eq('instance_id', instanceId);

    return { success: true, webhookUrl };
  }
}
