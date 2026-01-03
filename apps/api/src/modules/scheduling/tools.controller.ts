import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { AgentApiKeyGuard } from '../../common/guards/agent-api-key.guard';
import { SchedulingService } from './scheduling.service';
import { AvailableSlotsDto } from './dto/available-slots.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { PaymentLinkDto } from './dto/payment-link.dto';

@Controller('tools')
@UseGuards(AgentApiKeyGuard)
export class ToolsController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Get('available-slots')
  async getAvailableSlots(@Query() dto: AvailableSlotsDto) {
    return this.schedulingService.getAvailableSlots(dto);
  }

  @Post('appointments')
  async createAppointment(@Body() dto: CreateAppointmentDto) {
    return this.schedulingService.createAppointment(dto);
  }

  @Post('payment-link')
  async createPaymentLink(@Body() dto: PaymentLinkDto) {
    return this.schedulingService.createPaymentLink(dto);
  }
}

