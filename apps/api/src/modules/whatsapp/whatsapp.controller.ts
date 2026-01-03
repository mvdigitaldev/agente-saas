import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { UazapiWebhookDto } from './dto/uazapi-webhook.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('webhook')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('uazapi')
  @HttpCode(HttpStatus.OK)
  async handleUazapiWebhook(@Body() payload: UazapiWebhookDto) {
    await this.whatsappService.handleInboundMessage(payload);
    return { success: true };
  }
}

@Controller('whatsapp')
export class WhatsappSendController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('send')
  async sendMessage(@Body() dto: SendMessageDto) {
    return this.whatsappService.sendMessage(dto);
  }
}
