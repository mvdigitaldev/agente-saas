import { SchedulingService } from '../../../scheduling/scheduling.service';
import { ToolContext } from '../tool.interface';

export class InfoTools {
  constructor(private readonly schedulingService: SchedulingService) {}

  async listStaff(args: any, context: ToolContext) {
    return this.schedulingService.listStaff(context.empresa_id);
  }

  async listServices(args: any, context: ToolContext) {
    const activeOnly = args.active_only !== undefined ? args.active_only : true;
    return this.schedulingService.listServices(context.empresa_id, activeOnly);
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

