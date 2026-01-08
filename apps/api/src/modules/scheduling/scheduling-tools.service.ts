import { Injectable } from '@nestjs/common';
import { SchedulingService } from './scheduling.service';
import { AvailableSlotsDto } from './dto/available-slots.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

@Injectable()
export class SchedulingToolsService {
    constructor(private readonly schedulingService: SchedulingService) { }

    /**
     * Wrapper for get_available_slots tool.
     * Formats the output for the AI Agent.
     * Converte horários de UTC para horário do Brasil (UTC-3) para exibição.
     */
    async getAvailableSlots(dto: AvailableSlotsDto) {
        const result = await this.schedulingService.getAvailableSlots(dto);

        // Helper para converter UTC para horário do Brasil
        const utcToBrasil = (utcIsoString: string): string => {
            const utcDate = new Date(utcIsoString);
            // Subtrair 3 horas para converter de UTC para Brasil (UTC-3)
            const brasilDate = new Date(utcDate.getTime() - 3 * 60 * 60 * 1000);
            return brasilDate.toISOString();
        };

        // Retornar slots agrupados por staff para que a IA possa apresentar opções
        // Os horários são convertidos de UTC para horário do Brasil
        return result.staff_slots.map(staff => ({
            staff_id: staff.staff_id,
            staff_name: staff.staff_name,
            slots: staff.slots.map(slot => ({
                start: utcToBrasil(slot.start),
                end: utcToBrasil(slot.end)
            }))
        }));
    }

    /**
     * Wrapper for create_appointment tool.
     */
    async createAppointment(dto: CreateAppointmentDto) {
        return this.schedulingService.createAppointment(dto);
    }

    /**
     * Wrapper for cancel_appointment tool.
     */
    async cancelAppointment(appointmentId: string, empresaId: string) {
        return this.schedulingService.cancelAppointment(appointmentId, empresaId);
    }

    /**
     * Wrapper for reschedule_appointment tool.
     */
    async rescheduleAppointment(appointmentId: string, empresaId: string, data: { start_time: string; end_time: string }) {
        return this.schedulingService.rescheduleAppointment(appointmentId, empresaId, data);
    }

    /**
     * Wrapper for list_appointments tool.
     */
    async listAppointments(empresaId: string, filters: any) {
        return this.schedulingService.listAppointments(empresaId, filters);
    }
}
