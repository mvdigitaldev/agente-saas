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
        try {
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

            // Adicionar informações sobre profissionais disponíveis para o serviço
            // Isso ajuda o agente a entender quais profissionais podem fazer o serviço
            let availableStaffInfo = '';
            if (result.staff_slots && result.staff_slots.length > 0) {
                const staffNames = result.staff_slots.map(s => s.staff_name).join(', ');
                availableStaffInfo = `Profissionais disponíveis para este serviço: ${staffNames}. `;
            } else {
                availableStaffInfo = 'Nenhum profissional disponível para este serviço no período solicitado. ';
            }

            // Retornar slots agrupados por staff com horários formatados no timezone do Brasil
            // Formato simplificado para o agente exibir corretamente
            const formattedSlots = result.staff_slots.map((staff, staffIndex) => ({
                staff_id: staff.staff_id,
                staff_name: staff.staff_name,
                slots: staff.slots.map((slot, slotIndex) => {
                    const startFormatted = formatBrasilTime(slot.start);
                    const endFormatted = formatBrasilTime(slot.end);
                    
                    // Criar identificador único para o slot (para referência)
                    const slotId = `${staff.staff_id}_${startFormatted.date}_${startFormatted.time.replace(':', '')}`;
                    
                    // Texto formatado para exibição
                    const displayText = `${startFormatted.time} às ${endFormatted.time}`;
                    
                    return {
                        // Identificador único do slot
                        slot_id: slotId,
                        
                        // Campos principais para o agente usar
                        start_time: startFormatted.time, // Ex: "09:00" (horário do Brasil)
                        end_time: endFormatted.time,     // Ex: "10:00" (horário do Brasil)
                        date: startFormatted.date,       // Ex: "2026-01-12"
                        
                        // Campos ISO para uso interno (OBRIGATÓRIO usar em create_appointment)
                        start_iso: slot.start,           // Formato UTC original (ex: "2026-01-12T12:00:00Z")
                        end_iso: slot.end,               // Formato UTC original (ex: "2026-01-12T13:00:00Z")
                        
                        // Campo formatado para exibição
                        display_text: displayText,       // Ex: "09:00 às 10:00"
                        
                        // Informações de correspondência (para facilitar busca)
                        match_key: `${staff.staff_name.toLowerCase()}_${startFormatted.time}`, // Ex: "tereza_09:30"
                    };
                })
            }));

            // Retornar resposta formatada com informações adicionais
            return {
                info: availableStaffInfo + 
                      'Os horários listados abaixo são gerados a partir de regras de disponibilidade. ' +
                      'Regras específicas de profissional têm prioridade sobre regras gerais. ' +
                      'Use EXATAMENTE os campos staff_id, start_iso e end_iso ao criar agendamentos.',
                staff_slots: formattedSlots,
                total_slots: formattedSlots.reduce((sum, staff) => sum + staff.slots.length, 0),
            };
        } catch (error: any) {
            // Re-throw com mensagem mais clara para o agente
            if (error.message?.includes('Serviço não encontrado')) {
                throw new Error(
                    `Serviço não encontrado. O service_id "${dto.service_id}" não existe ou não está ativo. ` +
                    `Por favor, chame list_services primeiro para obter os service_ids válidos (UUIDs). ` +
                    `NUNCA use números simples como "1" ou "2" como service_id.`
                );
            }
            if (error.message?.includes('não há horários') || error.message?.includes('disponível')) {
                throw new Error(
                    `Não há horários disponíveis para o serviço na data solicitada. ` +
                    `Isso pode ocorrer porque: ` +
                    `1. Não há regras de disponibilidade cadastradas para aquele dia da semana. ` +
                    `2. Todos os horários já estão ocupados por agendamentos ou bloqueios. ` +
                    `3. O serviço não tem profissionais associados (verifique service_staff). ` +
                    `Sugira ao cliente outra data ou verifique a disponibilidade novamente.`
                );
            }
            throw error;
        }
    }

    /**
     * Wrapper for create_appointment tool.
     */
    async createAppointment(dto: CreateAppointmentDto) {
        try {
            const appointment = await this.schedulingService.createAppointment(dto);
            return {
                success: true,
                appointment_id: appointment.appointment_id,
                message: 'Agendamento criado com sucesso',
                appointment: appointment,
            };
        } catch (error: any) {
            // Re-throw com mensagem mais clara para o agente
            if (error.message?.includes('Conflito') || error.message?.includes('bloqueado')) {
                throw new Error(
                    `Não foi possível criar o agendamento: ${error.message}. ` +
                    `Por favor, sugira outro horário ao cliente ou verifique a disponibilidade novamente com get_available_slots.`
                );
            }
            if (error.message?.includes('não encontrado') || error.message?.includes('inativo')) {
                throw new Error(
                    `Erro ao criar agendamento: ${error.message}. ` +
                    `Por favor, verifique se está usando os dados corretos retornados por get_available_slots (staff_id, start_iso, end_iso).`
                );
            }
            throw error;
        }
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
