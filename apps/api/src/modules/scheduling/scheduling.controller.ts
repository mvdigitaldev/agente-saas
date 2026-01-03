import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SchedulingService } from './scheduling.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CreateBlockedTimeDto } from './dto/create-blocked-time.dto';

@Controller('scheduling')
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Get('appointments')
  async getAppointments(@Query('empresa_id') empresaId: string) {
    return this.schedulingService.getAppointments(empresaId);
  }

  @Post('appointments')
  async createAppointment(@Body() dto: CreateAppointmentDto) {
    return this.schedulingService.createAppointment(dto);
  }

  @Get('blocked-times')
  async getBlockedTimes(@Query('empresa_id') empresaId: string) {
    return this.schedulingService.getBlockedTimes(empresaId);
  }

  @Post('blocked-times')
  async createBlockedTime(@Body() dto: CreateBlockedTimeDto) {
    return this.schedulingService.createBlockedTime(dto);
  }

  @Delete('blocked-times/:id')
  async deleteBlockedTime(@Param('id') id: string) {
    return this.schedulingService.deleteBlockedTime(id);
  }
}

