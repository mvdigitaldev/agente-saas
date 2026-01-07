import { Injectable } from '@nestjs/common';
import { SchedulingService } from '../../../scheduling/scheduling.service';
import { ToolContext } from '../tool.interface';
import { AvailableSlotsDto } from '../../../scheduling/dto/available-slots.dto';
import { CreateAppointmentDto } from '../../../scheduling/dto/create-appointment.dto';

@Injectable()
export class SchedulingTools {
  constructor(private readonly schedulingService: SchedulingService) {}

  async checkAvailableSlots(args: any, context: ToolContext) {
    const dto: AvailableSlotsDto = {
      empresa_id: context.empresa_id,
      start_date: args.start_date,
      end_date: args.end_date,
    };

    if (args.service_id) {
      dto.service_id = args.service_id;
    }

    return this.schedulingService.getAvailableSlots(dto);
  }

  async createAppointment(args: any, context: ToolContext) {
    const dto: CreateAppointmentDto = {
      empresa_id: context.empresa_id,
      client_id: args.client_id || context.client_id,
      service_id: args.service_id,
      start_time: args.start_time,
      end_time: args.end_time,
    };

    if (args.staff_id) {
      dto.staff_id = args.staff_id;
    }
    if (args.resource_id) {
      dto.resource_id = args.resource_id;
    }
    if (args.notes) {
      dto.notes = args.notes;
    }

    return this.schedulingService.createAppointment(dto);
  }

  async rescheduleAppointment(args: any, context: ToolContext) {
    return this.schedulingService.rescheduleAppointment(
      args.appointment_id,
      context.empresa_id,
      {
        start_time: args.start_time,
        end_time: args.end_time,
      },
    );
  }

  async cancelAppointment(args: any, context: ToolContext) {
    return this.schedulingService.cancelAppointment(
      args.appointment_id,
      context.empresa_id,
    );
  }

  async listAppointments(args: any, context: ToolContext) {
    return this.schedulingService.listAppointments(context.empresa_id, {
      client_id: args.client_id || context.client_id,
      status: args.status,
      start_date: args.start_date,
      end_date: args.end_date,
    });
  }
}

