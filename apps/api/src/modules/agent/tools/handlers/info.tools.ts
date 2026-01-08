import { Injectable } from '@nestjs/common';
import { SchedulingService } from '../../../scheduling/scheduling.service';
import { ToolContext } from '../tool.interface';

@Injectable()
export class InfoTools {
  constructor(private readonly schedulingService: SchedulingService) {}

  async listStaff(args: any, context: ToolContext) {
    return this.schedulingService.listStaff(context.empresa_id);
  }

  async listServices(args: any, context: ToolContext) {
    const activeOnly = args.active_only !== undefined ? args.active_only : true;
    const result = await this.schedulingService.listServices(context.empresa_id, activeOnly);

    // Se o envio de mídia estiver desabilitado, remover URLs de imagens para evitar que o agente as use
    if (context.features && context.features.send_media_enabled === false && result.services) {
      result.services = result.services.map((svc: any) => {
        // Remove image_url e images para garantir
        const { image_url, images, ...rest } = svc;
        return rest;
      });
    }

    return result;
  }

  async listPrices(args: any, context: ToolContext) {
    // Reutilizar list_services e formatar apenas preços
    const servicesResult = await this.schedulingService.listServices(
      context.empresa_id,
      true,
    );

    const services = servicesResult.services || [];
    const prices = services.map((service: any) => ({
      service_id: service.service_id,
      nome: service.nome,
      preco: service.preco,
      duracao_minutos: service.duracao_minutos,
    }));

    return { prices };
  }
}

