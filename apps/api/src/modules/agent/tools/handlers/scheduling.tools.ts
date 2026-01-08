import { Injectable } from '@nestjs/common';
import { SchedulingToolsService } from '../../../scheduling/scheduling-tools.service';
import { ToolContext } from '../tool.interface';
import { AvailableSlotsDto } from '../../../scheduling/dto/available-slots.dto';
import { CreateAppointmentDto } from '../../../scheduling/dto/create-appointment.dto';

@Injectable()
export class SchedulingTools {
  constructor(private readonly schedulingToolsService: SchedulingToolsService) { }

  async getAvailableSlots(args: any, context: ToolContext) {
    const dto: AvailableSlotsDto = {
      empresa_id: context.empresa_id,
      start_date: args.start_date,
      end_date: args.end_date,
      service_id: args.service_id,
      staff_id: args.staff_id,
      resource_id: args.resource_id,
    };

    return this.schedulingToolsService.getAvailableSlots(dto);
  }

  async createAppointment(args: any, context: ToolContext) {
    const dto: CreateAppointmentDto = {
      empresa_id: context.empresa_id,
      client_id: args.client_id || context.client_id,
      service_id: args.service_id,
      staff_id: args.staff_id,
      start_time: args.start_time,
      end_time: args.end_time,
      notes: args.notes,
      resource_id: args.resource_id,
    };
    if (args.resource_id) {
      dto.resource_id = args.resource_id;
    }
    if (args.notes) {
      dto.notes = args.notes;
    }

    return this.schedulingToolsService.createAppointment(dto);
  }

  async rescheduleAppointment(args: any, context: ToolContext) {
    // Note: reschedule is not explicitly in SchedulingToolsService yet, but we can call it directly or add it.
    // For consistency with user's "agent burro", let's assume we use SchedulingToolsService if we added it there.
    // I added cancel and list to SchedulingToolsService, let's add reschedule too.
    return this.schedulingToolsService.rescheduleAppointment(
      args.appointment_id,
      context.empresa_id,
      {
        start_time: args.start_time,
        end_time: args.end_time,
      },
    );
  }

  async cancelAppointment(args: any, context: ToolContext) {
    return this.schedulingToolsService.cancelAppointment(
      args.appointment_id,
      context.empresa_id,
    );
  }

  async listAppointments(args: any, context: ToolContext) {
    return this.schedulingToolsService.listAppointments(context.empresa_id, {
      client_id: args.client_id || context.client_id,
      status: args.status,
      start_date: args.start_date,
      end_date: args.end_date,
    });
  }
}

