import { Injectable, Logger } from '@nestjs/common';
import { SchedulingToolsService } from '../../../scheduling/scheduling-tools.service';
import { ToolContext } from '../tool.interface';
import { AvailableSlotsDto } from '../../../scheduling/dto/available-slots.dto';
import { CreateAppointmentDto } from '../../../scheduling/dto/create-appointment.dto';
import { ToolContextService } from '../../context/tool-context.service';

@Injectable()
export class SchedulingTools {
  private readonly logger = new Logger(SchedulingTools.name);

  constructor(
    private readonly schedulingToolsService: SchedulingToolsService,
    private readonly toolContext: ToolContextService,
  ) { }

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
    // Validar se os dados correspondem a um slot válido do contexto
    const validationResult = this.validateSlotFromContext(
      context.conversation_id,
      args.staff_id,
      args.start_time,
      args.end_time,
    );

    if (!validationResult.isValid && validationResult.hasContext) {
      // Se há contexto mas os dados não correspondem, retornar erro descritivo
      this.logger.warn(
        `Tentativa de criar agendamento com dados que não correspondem ao contexto: staff_id=${args.staff_id}, start_time=${args.start_time}`,
      );
      throw new Error(
        `Os dados fornecidos (staff_id: ${args.staff_id}, start_time: ${args.start_time}) não correspondem a nenhum slot disponível listado anteriormente. ` +
        `Por favor, use EXATAMENTE os dados (staff_id, start_iso, end_iso) de um slot retornado por get_available_slots. ` +
        `Se você não tem os slots em contexto, chame get_available_slots primeiro para obter os slots disponíveis.`
      );
    }

    // Se não há contexto, apenas logar (pode ser primeira chamada ou contexto expirado)
    if (!validationResult.hasContext) {
      this.logger.debug(
        `Criando agendamento sem validação de contexto (contexto não disponível ou expirado)`,
      );
    }

    // Validar e corrigir client_id
    let finalClientId = args.client_id || context.client_id;
    
    // Detectar se o agente está usando a string literal "client_id" ou valor inválido
    if (!finalClientId || finalClientId === 'client_id' || finalClientId.trim() === '') {
      if (context.client_id) {
        this.logger.warn(
          `Agente forneceu client_id inválido ("${args.client_id}"), usando client_id do contexto: ${context.client_id}`,
        );
        finalClientId = context.client_id;
      } else {
        this.logger.error(
          `client_id não disponível. args.client_id="${args.client_id}", context.client_id="${context.client_id}"`,
        );
        throw new Error(
          `client_id não está disponível. O client_id deve ser um UUID válido obtido do contexto da conversa. ` +
          `Se você não tem o client_id, use o client_id fornecido no contexto do sistema (não use a string literal "client_id"). ` +
          `O sistema deveria ter fornecido o client_id no prompt. Se isso não aconteceu, há um erro no sistema.`
        );
      }
    }

    // Validar formato UUID básico
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(finalClientId)) {
      this.logger.error(`client_id não é um UUID válido: ${finalClientId}`);
      throw new Error(
        `client_id fornecido não é um UUID válido: "${finalClientId}". ` +
        `O client_id deve ser um UUID no formato "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx". ` +
        `Use o client_id fornecido no contexto do sistema.`
      );
    }

    const dto: CreateAppointmentDto = {
      empresa_id: context.empresa_id,
      client_id: finalClientId,
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

  /**
   * Valida se os dados fornecidos correspondem a um slot válido do contexto
   */
  private validateSlotFromContext(
    conversationId: string,
    staffId: string,
    startTime: string,
    endTime: string,
  ): { isValid: boolean; hasContext: boolean } {
    try {
      const schedulingContext = this.toolContext.getSchedulingContext(conversationId);
      
      if (!schedulingContext.availableSlots || !Array.isArray(schedulingContext.availableSlots)) {
        this.logger.debug(
          JSON.stringify({
            event: 'slot_validation',
            conversation_id: conversationId,
            has_context: false,
            reason: 'no_available_slots',
            timestamp: new Date().toISOString(),
          }),
        );
        return { isValid: false, hasContext: false };
      }

      // Logging de tentativa de validação
      this.logger.debug(
        JSON.stringify({
          event: 'slot_validation_attempt',
          conversation_id: conversationId,
          staff_id: staffId,
          start_time: startTime,
          end_time: endTime,
          available_staff_count: schedulingContext.availableSlots.length,
          timestamp: new Date().toISOString(),
        }),
      );

      // Procurar slot correspondente
      for (const staffSlot of schedulingContext.availableSlots) {
        if (staffSlot.staff_id === staffId && staffSlot.slots && Array.isArray(staffSlot.slots)) {
          const matchingSlot = staffSlot.slots.find(
            (slot: any) => slot.start_iso === startTime && slot.end_iso === endTime,
          );

          if (matchingSlot) {
            this.logger.log(
              JSON.stringify({
                event: 'slot_validation_success',
                conversation_id: conversationId,
                staff_id: staffId,
                staff_name: staffSlot.staff_name,
                start_iso: startTime,
                end_iso: endTime,
                slot_id: matchingSlot.slot_id,
                timestamp: new Date().toISOString(),
              }),
            );
            return { isValid: true, hasContext: true };
          }
        }
      }

      // Slot não encontrado no contexto - logar detalhes
      const availableStaffIds = schedulingContext.availableSlots.map(s => s.staff_id);
      const allSlots = schedulingContext.availableSlots.flatMap(s => s.slots || []);
      const availableStartTimes = allSlots.map(s => s.start_iso);
      
      this.logger.warn(
        JSON.stringify({
          event: 'slot_validation_failed',
          conversation_id: conversationId,
          requested_staff_id: staffId,
          requested_start_time: startTime,
          requested_end_time: endTime,
          available_staff_ids: availableStaffIds,
          available_start_times_count: availableStartTimes.length,
          available_start_times_sample: availableStartTimes.slice(0, 5), // Primeiros 5 para não logar tudo
          timestamp: new Date().toISOString(),
        }),
      );

      // Slot não encontrado no contexto
      return { isValid: false, hasContext: true };
    } catch (error: any) {
      this.logger.error(
        JSON.stringify({
          event: 'slot_validation_error',
          conversation_id: conversationId,
          error_message: error.message,
          error_stack: error.stack,
          timestamp: new Date().toISOString(),
        }),
      );
      // Em caso de erro, não bloquear (pode ser problema temporário)
      return { isValid: false, hasContext: false };
    }
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

