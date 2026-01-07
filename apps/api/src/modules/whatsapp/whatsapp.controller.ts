import { Controller, Post, Body, Get, Param, Query, HttpCode, HttpStatus, Delete, Req } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { UazapiService } from './uazapi.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateInstanceDto } from './dto/create-instance.dto';
import { SupabaseService } from '../../database/supabase.service';
import { Request } from 'express';

@Controller('webhook')
export class WhatsappController {
  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly uazapiService: UazapiService,
  ) { }

  @Post('uazapi')
  @HttpCode(HttpStatus.OK)
  async handleUazapiWebhook(
    @Req() req: Request,
    @Query('instance_id') instanceId?: string,
  ) {
    // Pegar body raw sem validação do class-validator
    const payload = req.body;

    // Log detalhado do webhook recebido
    console.log('═══════════════════════════════════════════════');
    console.log(`📥 [${new Date().toISOString()}] WEBHOOK RECEBIDO`);
    console.log('Instance ID (query):', instanceId);
    console.log('Event Type:', payload.EventType);
    console.log('Message:', payload.message?.text || payload.message?.content || '(sem texto)');
    console.log('═══════════════════════════════════════════════');

    try {
      await this.whatsappService.handleInboundMessage(payload, instanceId);
      console.log('✅ Webhook processado com sucesso');
      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro no webhook:', error.message, error.stack);
      // Sempre retornar 200 para não quebrar o webhook da Uazapi
      return { success: false, error: error.message };
    }
  }
}

@Controller('whatsapp')
export class WhatsappSendController {
  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly uazapiService: UazapiService,
    private readonly supabase: SupabaseService,
  ) { }

  /**
   * Cria uma nova instância e retorna QR code diretamente
   */
  @Post('instances')
  async createInstance(@Body() dto: CreateInstanceDto) {
    return this.whatsappService.createInstance(dto);
  }

  /**
   * Busca QR code atualizado da instância
   */
  @Get('instances/:id/qrcode')
  async getQrCode(
    @Param('id') id: string,
    @Query('empresa_id') empresaId: string,
  ) {
    return this.whatsappService.getQrCode(id, empresaId);
  }

  /**
   * Verifica status da instância e atualiza no banco
   */
  @Get('instances/:id/status')
  async getInstanceStatus(
    @Param('id') id: string,
    @Query('empresa_id') empresaId: string,
  ) {
    return this.whatsappService.getInstanceStatus(id, empresaId);
  }

  /**
   * Desconecta WhatsApp da empresa
   */
  @Post('instances/:id/disconnect')
  async disconnect(
    @Param('id') id: string,
    @Query('empresa_id') empresaId: string,
  ) {
    await this.whatsappService.disconnect(id, empresaId);
    return { success: true };
  }

  /**
   * Deleta instância (usado quando timeout expira ou cancelamento)
   */
  @Delete('instances/:id')
  async deleteInstance(
    @Param('id') id: string,
    @Query('empresa_id') empresaId: string,
  ) {
    await this.whatsappService.deleteInstance(id, empresaId);
    return { success: true };
  }

  /**
   * Busca status da conexão WhatsApp da empresa
   */
  @Get('status')
  async getStatus(@Query('empresa_id') empresaId: string) {
    const db = this.supabase.getServiceRoleClient();

    const { data: instance } = await db
      .from('whatsapp_instances')
      .select('*')
      .eq('empresa_id', empresaId)
      .single();

    if (!instance) {
      return {
        connected: false,
        status: 'disconnected',
        phone_number: null,
        instance_id: null,
        qr_code: null,
      };
    }

    // Retornar dados do banco diretamente (igual ao iAgenda)
    // O polling no frontend vai atualizar quando necessário
    return {
      connected: instance.status === 'connected',
      status: instance.status,
      phone_number: instance.phone_number,
      instance_id: instance.instance_id,
      qr_code: instance.status === 'connecting' ? (instance.qr_code_url || null) : null,
      qr_code_expires_at: instance.qr_code_expires_at,
      connected_at: instance.connected_at,
      last_sync_at: instance.last_sync_at,
    };
  }

  /**
   * Envia mensagem de texto
   */
  @Post('send')
  async sendMessage(@Body() dto: SendMessageDto) {
    return this.whatsappService.sendMessage(dto);
  }

  /**
   * Envia mídia (imagem, vídeo, documento)
   */
  @Post('send-media')
  async sendMedia(
    @Body() data: {
      empresa_id: string;
      conversation_id?: string;
      phone_number?: string;
      url: string;
      media_type?: 'image' | 'video' | 'document';
      caption?: string;
    },
  ) {
    return this.whatsappService.sendMedia(data);
  }

  /**
   * Atualiza o webhook da instância (DEV LOCAL)
   */
  @Post('instances/:id/webhook')
  async updateWebhook(
    @Param('id') id: string,
    @Query('empresa_id') empresaId: string,
  ) {
    return this.whatsappService.updateWebhook(id, empresaId);
  }
}
