import { WhatsappService } from '../../../whatsapp/whatsapp.service';
import { ToolContext } from '../tool.interface';

export class MediaTools {
  constructor(private readonly whatsappService: WhatsappService) {}

  async sendMedia(args: any, context: ToolContext) {
    return this.whatsappService.sendMedia({
      empresa_id: context.empresa_id,
      conversation_id: context.conversation_id,
      url: args.url,
      media_type: args.media_type || 'image',
      caption: args.caption,
    });
  }
}

