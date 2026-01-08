import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { SchedulingService } from './scheduling.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CreateBlockedTimeDto } from './dto/create-blocked-time.dto';
import { AvailableSlotsDto } from './dto/available-slots.dto';
import { CreateAvailabilityRuleDto } from './dto/create-availability-rule.dto';
import { UpdateAvailabilityRuleDto } from './dto/update-availability-rule.dto';

@Controller('scheduling')
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) { }

  @Get('appointments')
  async getAppointments(@Query('empresa_id') empresaId: string) {
    return this.schedulingService.getAppointments(empresaId);
  }

  @Get('available-slots')
  async getAvailableSlots(@Query() dto: AvailableSlotsDto) {
    return this.schedulingService.getAvailableSlots(dto);
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

  @Get('availability-rules')
  async listAvailabilityRules(@Query('empresa_id') empresaId: string) {
    return this.schedulingService.listAvailabilityRules(empresaId);
  }

  @Post('availability-rules')
  async createAvailabilityRule(@Body() dto: CreateAvailabilityRuleDto) {
    return this.schedulingService.createAvailabilityRule(dto);
  }

  @Put('availability-rules/:id')
  async updateAvailabilityRule(
    @Param('id') id: string,
    @Query('empresa_id') empresaId: string,
    @Body() dto: UpdateAvailabilityRuleDto,
  ) {
    return this.schedulingService.updateAvailabilityRule(id, empresaId, dto);
  }

  @Delete('availability-rules/:id')
  async deleteAvailabilityRule(@Param('id') id: string, @Query('empresa_id') empresaId: string) {
    return this.schedulingService.deleteAvailabilityRule(id, empresaId);
  }

  @Get('staff')
  async listStaff(@Query('empresa_id') empresaId: string) {
    return this.schedulingService.listStaff(empresaId);
  }

  @Post('staff')
  async createStaff(@Body() dto: any) {
    return this.schedulingService.createStaff(dto);
  }

  @Delete('staff/:id')
  async deleteStaff(@Param('id') id: string, @Query('empresa_id') empresaId: string) {
    return this.schedulingService.deleteStaff(id, empresaId);
  }

  @Get('services')
  async listServices(@Query('empresa_id') empresaId: string) {
    return this.schedulingService.listServices(empresaId);
  }

  @Get('staff/:id/services')
  async getStaffServices(@Param('id') id: string, @Query('empresa_id') empresaId: string) {
    return this.schedulingService.getStaffServices(id, empresaId);
  }

  @Post('staff/:id/services')
  async updateStaffServices(
    @Param('id') id: string,
    @Query('empresa_id') empresaId: string,
    @Body() body: { service_ids: string[] },
  ) {
    return this.schedulingService.updateStaffServices(id, empresaId, body.service_ids || []);
  }
}
