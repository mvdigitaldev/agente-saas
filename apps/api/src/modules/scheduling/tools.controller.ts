import { Controller, Get, Post, Patch, Delete, Body, Query, Param, UseGuards } from '@nestjs/common';
import { AgentApiKeyGuard } from '../../common/guards/agent-api-key.guard';
import { SchedulingService } from './scheduling.service';
import { ConversationsService } from '../conversations/conversations.service';
import { AvailableSlotsDto } from './dto/available-slots.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { PaymentLinkDto } from './dto/payment-link.dto';

@Controller('tools')
@UseGuards(AgentApiKeyGuard)
export class ToolsController {
  constructor(
    private readonly schedulingService: SchedulingService,
    private readonly conversationsService: ConversationsService,
  ) {}

  @Get('available-slots')
  async getAvailableSlots(@Query() dto: AvailableSlotsDto) {
    return this.schedulingService.getAvailableSlots(dto);
  }

  @Post('appointments')
  async createAppointment(@Body() dto: CreateAppointmentDto) {
    return this.schedulingService.createAppointment(dto);
  }

  @Patch('appointments/:id')
  async rescheduleAppointment(
    @Param('id') appointmentId: string,
    @Query('empresa_id') empresaId: string,
    @Body() data: { start_time: string; end_time: string },
  ) {
    return this.schedulingService.rescheduleAppointment(appointmentId, empresaId, data);
  }

  @Delete('appointments/:id')
  async cancelAppointment(
    @Param('id') appointmentId: string,
    @Query('empresa_id') empresaId: string,
  ) {
    return this.schedulingService.cancelAppointment(appointmentId, empresaId);
  }

  @Get('appointments')
  async listAppointments(
    @Query('empresa_id') empresaId: string,
    @Query('client_id') clientId?: string,
    @Query('status') status?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.schedulingService.listAppointments(empresaId, {
      client_id: clientId,
      status,
      start_date: startDate,
      end_date: endDate,
    });
  }

  @Get('staff')
  async listStaff(@Query('empresa_id') empresaId: string) {
    return this.schedulingService.listStaff(empresaId);
  }

  @Get('services')
  async listServices(
    @Query('empresa_id') empresaId: string,
    @Query('active_only') activeOnly?: string,
  ) {
    const activeOnlyBool = activeOnly !== 'false';
    return this.schedulingService.listServices(empresaId, activeOnlyBool);
  }

  @Get('payment-status/:id')
  async checkPaymentStatus(
    @Param('id') paymentId: string,
    @Query('empresa_id') empresaId: string,
  ) {
    return this.schedulingService.checkPaymentStatus(paymentId, empresaId);
  }

  @Post('payment-link')
  async createPaymentLink(@Body() dto: PaymentLinkDto) {
    return this.schedulingService.createPaymentLink(dto);
  }

  @Post('human-handoff')
  async requestHumanHandoff(
    @Body() data: { empresa_id: string; conversation_id: string; reason?: string },
  ) {
    return this.conversationsService.requestHumanHandoff(data);
  }
}

