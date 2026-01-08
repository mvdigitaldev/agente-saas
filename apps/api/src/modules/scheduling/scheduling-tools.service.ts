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
     * Os slots já estão em UTC representando horários do Brasil.
     * Formatamos para retornar no formato legível com horário do Brasil.
     */
    async getAvailableSlots(dto: AvailableSlotsDto) {
        const result = await this.schedulingService.getAvailableSlots(dto);

        // Helper para formatar horário UTC para horário do Brasil legível
        // Os slots em UTC representam horários do Brasil (ex: 12:00 UTC = 09:00 Brasil)
        // Para exibir corretamente, usamos toLocaleString com timezone do Brasil
        const formatBrasilTime = (utcIsoString: string): { iso: string; time: string; date: string } => {
            const utcDate = new Date(utcIsoString);
            
            // Usar toLocaleString para obter horário no timezone do Brasil
            const brasilTimeStr = utcDate.toLocaleString('pt-BR', { 
                timeZone: 'America/Sao_Paulo',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            
            // Formato: "08/01/2026 09:00:00"
            const [datePart, timePart] = brasilTimeStr.split(' ');
            const [day, month, year] = datePart.split('/');
            const [hours, minutes] = timePart.split(':');
            
            return {
                iso: `${year}-${month}-${day}T${hours}:${minutes}:00`, // Formato ISO sem timezone
                time: `${hours}:${minutes}`, // Apenas hora
                date: `${year}-${month}-${day}` // Apenas data
            };
        };

        // Retornar slots agrupados por staff com horários formatados no timezone do Brasil
        // Formato simplificado para o agente exibir corretamente
        return result.staff_slots.map(staff => ({
            staff_id: staff.staff_id,
            staff_name: staff.staff_name,
            slots: staff.slots.map(slot => {
                const startFormatted = formatBrasilTime(slot.start);
                const endFormatted = formatBrasilTime(slot.end);
                return {
                    // Campos principais para o agente usar
                    start_time: startFormatted.time, // Ex: "09:00" (horário do Brasil)
                    end_time: endFormatted.time,     // Ex: "10:00" (horário do Brasil)
                    date: startFormatted.date,       // Ex: "2026-01-12"
                    // Campos ISO para uso interno se necessário
                    start_iso: slot.start,           // Formato UTC original
                    end_iso: slot.end                 // Formato UTC original
                };
            })
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
