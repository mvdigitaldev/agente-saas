import { Controller, Post, Body, Get, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { UazapiService } from './uazapi.service';
import { UazapiWebhookDto } from './dto/uazapi-webhook.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateInstanceDto } from './dto/create-instance.dto';

@Controller('webhook')
export class WhatsappController {
  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly uazapiService: UazapiService,
  ) {}

  @Post('uazapi')
  @HttpCode(HttpStatus.OK)
  async handleUazapiWebhook(
    @Body() payload: UazapiWebhookDto,
    @Query('instance_id') instanceId?: string,
  ) {
    try {
      await this.whatsappService.handleInboundMessage(payload, instanceId);
      return { success: true };
    } catch (error: any) {
      console.error('Erro no webhook:', error);
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
  ) {}

  @Post('instances')
  async createInstance(@Body() dto: CreateInstanceDto) {
    return this.whatsappService.createInstance(dto);
  }

  @Get('instances/:id/qrcode')
  async getQrCode(@Param('id') id: string, @Query('empresa_id') empresaId: string) {
    return this.whatsappService.getQrCode(id, empresaId);
  }

  @Get('instances/:id/status')
  async getInstanceStatus(@Param('id') id: string, @Query('empresa_id') empresaId: string) {
    return this.whatsappService.getInstanceStatus(id, empresaId);
  }

  @Post('send')
  async sendMessage(@Body() dto: SendMessageDto) {
    return this.whatsappService.sendMessage(dto);
  }
}
