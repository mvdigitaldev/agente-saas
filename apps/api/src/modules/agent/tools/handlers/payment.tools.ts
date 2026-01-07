import { Injectable } from '@nestjs/common';
import { SchedulingService } from '../../../scheduling/scheduling.service';
import { ToolContext } from '../tool.interface';
import { PaymentLinkDto } from '../../../scheduling/dto/payment-link.dto';

@Injectable()
export class PaymentTools {
  constructor(private readonly schedulingService: SchedulingService) {}

  async checkPaymentStatus(args: any, context: ToolContext) {
    return this.schedulingService.checkPaymentStatus(
      args.payment_id,
      context.empresa_id,
    );
  }

  async createPaymentLink(args: any, context: ToolContext) {
    const dto: PaymentLinkDto = {
      empresa_id: context.empresa_id,
      appointment_id: args.appointment_id,
      amount: args.amount,
    };

    // A validação de ask_for_pix já está no SchedulingService.createPaymentLink
    return this.schedulingService.createPaymentLink(dto);
  }
}

