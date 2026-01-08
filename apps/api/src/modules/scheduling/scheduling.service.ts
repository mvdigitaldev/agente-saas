import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CreateBlockedTimeDto } from './dto/create-blocked-time.dto';
import { AvailableSlotsDto } from './dto/available-slots.dto';
import { PaymentLinkDto } from './dto/payment-link.dto';
import { CreateAvailabilityRuleDto } from './dto/create-availability-rule.dto';
import { UpdateAvailabilityRuleDto } from './dto/update-availability-rule.dto';

@Injectable()
export class SchedulingService {
  constructor(private supabase: SupabaseService) { }

  async getAvailableSlots(dto: AvailableSlotsDto) {
    const db = this.supabase.getServiceRoleClient();

    // 1. Buscar duração do serviço e colaboradores associados
    const { data: service, error: serviceError } = await db
      .from('services')
      .select('duracao_minutos, service_staff(staff_id, staff(nome))')
      .eq('empresa_id', dto.empresa_id)
      .eq('service_id', dto.service_id)
      .single();

    if (serviceError || !service) {
      // Buscar lista de serviços disponíveis para sugerir ao agente
      const { data: availableServices } = await db
        .from('services')
        .select('service_id, nome')
        .eq('empresa_id', dto.empresa_id)
        .eq('ativo', true)
        .limit(10);

      const servicesList = availableServices?.map(s => `- ${s.nome} (ID: ${s.service_id})`).join('\n') || 'Nenhum serviço encontrado';
      
      throw new BadRequestException(
        `Serviço não encontrado. O service_id "${dto.service_id}" não existe ou não está ativo. ` +
        `Por favor, chame list_services primeiro para obter os service_ids válidos. ` +
        `Serviços disponíveis:\n${servicesList}`
      );
    }

    const duration = service.duracao_minutos;
    const associatedStaff = (service.service_staff as any[]) || [];

    // Se dto.staff_id for fornecido, filtrar apenas esse staff se ele estiver associado ao serviço
    let staffToProcess = associatedStaff;
    if (dto.staff_id) {
      staffToProcess = associatedStaff.filter(s => s.staff_id === dto.staff_id);
      if (staffToProcess.length === 0) {
        throw new BadRequestException('O colaborador selecionado não realiza este serviço');
      }
    }

    // Se não há colaboradores associados ao serviço, buscar todos os colaboradores ativos da empresa
    // para verificar se há horários gerais disponíveis
    // Se não houver colaboradores, criar um "staff virtual" para processar regras gerais
    if (staffToProcess.length === 0) {
      const { data: allStaff } = await db
        .from('staff')
        .select('staff_id, nome')
        .eq('empresa_id', dto.empresa_id)
        .eq('ativo', true);
      
      if (!allStaff || allStaff.length === 0) {
        // Se não há colaboradores, criar um staff virtual para processar regras gerais
        // Isso permite que serviços sem colaboradores associados ainda possam usar horários gerais
        staffToProcess = [{ staff_id: null, staff: { nome: 'Todos' } }];
      } else {
        // Criar lista temporária para processar horários gerais
        staffToProcess = allStaff.map(s => ({ staff_id: s.staff_id, staff: { nome: s.nome } }));
      }
    }

    const staffResults = [];

    // Helper para criar data/hora no timezone do Brasil
    // Os horários no banco são interpretados como horário local do Brasil (UTC-3)
    // JavaScript Date trabalha em UTC, então 09:00 no Brasil = 12:00 UTC
    const createBrasilDateTime = (dateStr: string, timeStr: string): Date => {
      // dateStr vem como "2026-01-09", timeStr vem como "09:00:00" ou "09:00"
      const timeParts = timeStr.split(':');
      const hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1] || '0', 10);
      
      // Se o horário é 09:00 no Brasil (UTC-3), em UTC é 12:00 (09:00 + 3h)
      const utcHours = hours + 3;
      const utcDateStr = `${dateStr}T${String(utcHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00Z`;
      return new Date(utcDateStr);
    };

    // Parse das datas: assumir que "2026-01-09" representa 09/01/2026 no Brasil
    // Criar data no meio-dia no Brasil (12:00 Brasil = 15:00 UTC) para evitar problemas de timezone
    const parseDate = (dateStr: string): { dateStr: string; dayOfWeek: number } => {
      const brasilMidday = new Date(`${dateStr}T15:00:00Z`); // 12:00 Brasil = 15:00 UTC
      return {
        dateStr: dateStr,
        dayOfWeek: brasilMidday.getUTCDay()
      };
    };

    // Processar cada dia no intervalo
    const startDateInfo = parseDate(dto.start_date);
    const endDateInfo = parseDate(dto.end_date || dto.start_date);
    
    // Criar array de datas para processar
    const datesToProcess: string[] = [];
    const start = new Date(`${startDateInfo.dateStr}T15:00:00Z`);
    const end = new Date(`${endDateInfo.dateStr}T15:00:00Z`);
    const oneDay = 24 * 60 * 60 * 1000;
    
    for (let d = start.getTime(); d <= end.getTime(); d += oneDay) {
      const date = new Date(d);
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      datesToProcess.push(`${year}-${month}-${day}`);
    }

    for (const s of staffToProcess) {
      const staffId = s.staff_id;
      const staffName = s.staff?.nome || 'Colaborador';
      const slots = [];

      // Loop por cada dia no intervalo
      for (const dateStr of datesToProcess) {
        const dateInfo = parseDate(dateStr);
        const dayOfWeek = dateInfo.dayOfWeek;

        // 2. Buscar regras de disponibilidade para o colaborador
        let rules = null;
        
        if (staffId) {
          // Primeiro tenta buscar regras específicas do colaborador
          const { data: specificRules } = await db
            .from('availability_rules')
            .select('*')
            .eq('empresa_id', dto.empresa_id)
            .eq('day_of_week', dayOfWeek)
            .eq('staff_id', staffId);

          rules = specificRules;
        }
        
        // Se não encontrar regras específicas (ou se staffId é null), busca regras gerais (staff_id NULL)
        if (!rules || rules.length === 0) {
          const { data: generalRules } = await db
            .from('availability_rules')
            .select('*')
            .eq('empresa_id', dto.empresa_id)
            .eq('day_of_week', dayOfWeek)
            .is('staff_id', null);
          
          rules = generalRules;
        }

        // Se ainda não encontrou regras, pula para o próximo dia
        if (!rules || rules.length === 0) continue;

        // 3. Buscar appointments e blocked_times do dia para este colaborador
        // Usar UTC para buscar no banco (que armazena em UTC)
        const dayStart = `${dateStr}T00:00:00Z`;
        const dayEnd = `${dateStr}T23:59:59Z`;

        const { data: appointments } = await db
          .from('appointments')
          .select('start_time, end_time')
          .eq('empresa_id', dto.empresa_id)
          .eq('staff_id', staffId)
          .gte('start_time', dayStart)
          .lte('start_time', dayEnd)
          .in('status', ['scheduled', 'confirmed']);

        const { data: blocks } = await db
          .from('blocked_times')
          .select('start_time, end_time')
          .eq('empresa_id', dto.empresa_id)
          .eq('staff_id', staffId)
          .gte('start_time', dayStart)
          .lte('start_time', dayEnd);

        // 4. Gerar slots para cada regra
        for (const rule of rules) {
          // Criar datas no timezone do Brasil
          let current = createBrasilDateTime(dateStr, rule.start_time);
          const ruleEnd = createBrasilDateTime(dateStr, rule.end_time);

          while (new Date(current.getTime() + duration * 60000) <= ruleEnd) {
            const slotStart = new Date(current);
            const slotEnd = new Date(current.getTime() + duration * 60000);

            // Verificar colisão com appointments
            const hasApptCollision = appointments?.some(appt => {
              const apptStart = new Date(appt.start_time);
              const apptEnd = new Date(appt.end_time);
              return slotStart < apptEnd && slotEnd > apptStart;
            });

            // Verificar colisão com bloqueios
            const hasBlockCollision = blocks?.some(block => {
              const blockStart = new Date(block.start_time);
              const blockEnd = new Date(block.end_time);
              return slotStart < blockEnd && slotEnd > blockStart;
            });

            if (!hasApptCollision && !hasBlockCollision) {
              slots.push({
                start: slotStart.toISOString(),
                end: slotEnd.toISOString(),
              });
            }

            const step = 15; // 15 minutos de step
            current = new Date(current.getTime() + step * 60000);
          }
        }
      }

      if (slots.length > 0) {
        staffResults.push({
          staff_id: staffId,
          staff_name: staffName,
          slots: slots,
        });
      }
    }

    return {
      staff_slots: staffResults,
    };
  }

  /**
   * Converte horário UTC (que representa horário do Brasil) para formato local
   * Exemplo: "2026-01-14T17:00:00Z" (17:00 UTC = 14:00 Brasil) -> "2026-01-14T14:00:00"
   * 
   * Esta função é necessária porque os slots disponíveis retornam horários em UTC
   * que representam horários do Brasil. Quando salvamos no banco, precisamos
   * converter para o horário local do Brasil para que seja exibido corretamente.
   */
  private convertUtcToBrasilLocal(utcIsoString: string): string {
    // Garantir que a string seja tratada como UTC
    // Se não tiver indicador de timezone (Z, +, -), adicionar Z
    let normalizedUtcString = utcIsoString;
    if (!utcIsoString.endsWith('Z') && !utcIsoString.match(/[+-]\d{2}:\d{2}$/)) {
      // Se termina com números (sem timezone), adicionar Z para indicar UTC
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(utcIsoString)) {
        normalizedUtcString = `${utcIsoString}Z`;
      }
    }
    
    const utcDate = new Date(normalizedUtcString);
    
    // Usar Intl.DateTimeFormat para obter os componentes no timezone do Brasil
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // Formatar a data no timezone do Brasil
    const parts = formatter.formatToParts(utcDate);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    const hours = parts.find(p => p.type === 'hour')?.value;
    const minutes = parts.find(p => p.type === 'minute')?.value;
    const seconds = parts.find(p => p.type === 'second')?.value;
    
    // Retornar no formato ISO sem timezone (será interpretado como local pelo banco)
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  async createAppointment(dto: CreateAppointmentDto) {
    const db = this.supabase.getServiceRoleClient();

    // Converter horários UTC para horário local do Brasil antes de salvar
    // Os horários vêm em UTC (ex: "2026-01-14T17:00:00Z" que representa 14:00 no Brasil)
    // Precisamos converter para o formato local (ex: "2026-01-14T14:00:00")
    const startTimeLocal = this.convertUtcToBrasilLocal(dto.start_time);
    const endTimeLocal = this.convertUtcToBrasilLocal(dto.end_time);

    // Verificar se não conflita com agendamentos existentes
    const { data: conflictingAppointment } = await db
      .from('appointments')
      .select('*')
      .eq('empresa_id', dto.empresa_id)
      .eq('status', 'scheduled')
      .or(`and(start_time.lt.${endTimeLocal},end_time.gt.${startTimeLocal})`)
      .maybeSingle();

    if (conflictingAppointment) {
      throw new BadRequestException(
        `Conflito: Já existe um agendamento neste horário (ID: ${conflictingAppointment.appointment_id})`
      );
    }

    // Verificar se não conflita com bloqueios
    const { data: conflictingBlock } = await db
      .from('blocked_times')
      .select('*')
      .eq('empresa_id', dto.empresa_id)
      .or(`and(start_time.lt.${endTimeLocal},end_time.gt.${startTimeLocal})`)
      .maybeSingle();

    if (conflictingBlock) {
      throw new BadRequestException('Horário bloqueado');
    }

    // Verificar se o staff existe e pertence à empresa
    if (dto.staff_id) {
      const { data: staff } = await db
        .from('staff')
        .select('staff_id, nome')
        .eq('staff_id', dto.staff_id)
        .eq('empresa_id', dto.empresa_id)
        .eq('ativo', true)
        .maybeSingle();

      if (!staff) {
        throw new BadRequestException(
          `Profissional não encontrado ou inativo. staff_id: ${dto.staff_id}`
        );
      }
    }

    // Verificar se o serviço existe e pertence à empresa
    const { data: service } = await db
      .from('services')
      .select('service_id, nome')
      .eq('service_id', dto.service_id)
      .eq('empresa_id', dto.empresa_id)
      .eq('ativo', true)
      .maybeSingle();

    if (!service) {
      throw new BadRequestException(
        `Serviço não encontrado ou inativo. service_id: ${dto.service_id}`
      );
    }

    const { data: appointment, error: insertError } = await db
      .from('appointments')
      .insert({
        empresa_id: dto.empresa_id,
        client_id: dto.client_id,
        service_id: dto.service_id,
        staff_id: dto.staff_id,
        resource_id: dto.resource_id,
        start_time: startTimeLocal,
        end_time: endTimeLocal,
        status: 'scheduled',
        notes: dto.notes,
      })
      .select()
      .single();

    if (insertError) {
      throw new BadRequestException(
        `Erro ao criar agendamento: ${insertError.message}`
      );
    }

    return appointment;
  }

  async createBlockedTime(dto: CreateBlockedTimeDto) {
    const db = this.supabase.getServiceRoleClient();

    const { data: block } = await db
      .from('blocked_times')
      .insert({
        empresa_id: dto.empresa_id,
        start_time: dto.start_time,
        end_time: dto.end_time,
        motivo: dto.motivo,
        staff_id: dto.staff_id,
        resource_id: dto.resource_id,
        created_by: dto.created_by,
      })
      .select()
      .single();

    return block;
  }

  async getBlockedTimes(empresaId: string) {
    const db = this.supabase.getServiceRoleClient();

    const { data } = await db
      .from('blocked_times')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('start_time', { ascending: true });

    return data;
  }

  async deleteBlockedTime(id: string) {
    const db = this.supabase.getServiceRoleClient();

    await db.from('blocked_times').delete().eq('block_id', id);

    return { success: true };
  }

  async getAppointments(empresaId: string) {
    const db = this.supabase.getServiceRoleClient();

    const { data } = await db
      .from('appointments')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('start_time', { ascending: true });

    return data;
  }

  async createPaymentLink(dto: PaymentLinkDto) {
    const db = this.supabase.getServiceRoleClient();

    // Verificar se ask_for_pix está habilitado
    const { data: features } = await db
      .from('agent_features')
      .select('ask_for_pix')
      .eq('empresa_id', dto.empresa_id)
      .single();

    if (!features?.ask_for_pix) {
      throw new BadRequestException('ask_for_pix está desabilitado para esta empresa');
    }

    // Criar link de pagamento (integração com Asaas/Stripe/etc)
    // Por enquanto, retorna um link mock
    const { data: link } = await db
      .from('payment_links')
      .insert({
        empresa_id: dto.empresa_id,
        appointment_id: dto.appointment_id,
        amount: dto.amount,
        url: `https://payment.example.com/link/${Date.now()}`,
        status: 'pending',
      })
      .select()
      .single();

    return link;
  }

  async rescheduleAppointment(appointmentId: string, empresaId: string, data: { start_time: string; end_time: string }) {
    const db = this.supabase.getServiceRoleClient();

    // Converter horários UTC para horário local do Brasil antes de salvar
    const startTimeLocal = this.convertUtcToBrasilLocal(data.start_time);
    const endTimeLocal = this.convertUtcToBrasilLocal(data.end_time);

    // Verificar se agendamento existe e pertence à empresa
    const { data: appointment } = await db
      .from('appointments')
      .select('*')
      .eq('appointment_id', appointmentId)
      .eq('empresa_id', empresaId)
      .single();

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado');
    }

    // Verificar se não conflita com bloqueios
    const { data: conflictingBlock } = await db
      .from('blocked_times')
      .select('*')
      .eq('empresa_id', empresaId)
      .or(`start_time.lte.${endTimeLocal},end_time.gte.${startTimeLocal}`)
      .single();

    if (conflictingBlock) {
      throw new BadRequestException('Novo horário está bloqueado');
    }

    // Verificar conflitos com outros agendamentos
    const { data: conflictingAppointment } = await db
      .from('appointments')
      .select('*')
      .eq('empresa_id', empresaId)
      .neq('appointment_id', appointmentId)
      .in('status', ['scheduled', 'confirmed'])
      .or(`start_time.lte.${endTimeLocal},end_time.gte.${startTimeLocal}`)
      .single();

    if (conflictingAppointment) {
      throw new BadRequestException('Novo horário conflita com outro agendamento');
    }

    // Atualizar agendamento
    const { data: updated } = await db
      .from('appointments')
      .update({
        start_time: startTimeLocal,
        end_time: endTimeLocal,
        updated_at: new Date().toISOString(),
      })
      .eq('appointment_id', appointmentId)
      .eq('empresa_id', empresaId)
      .select()
      .single();

    return updated;
  }

  async cancelAppointment(appointmentId: string, empresaId: string) {
    const db = this.supabase.getServiceRoleClient();

    // Verificar se agendamento existe e pertence à empresa
    const { data: appointment } = await db
      .from('appointments')
      .select('*')
      .eq('appointment_id', appointmentId)
      .eq('empresa_id', empresaId)
      .single();

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado');
    }

    if (appointment.status === 'cancelled') {
      throw new BadRequestException('Agendamento já está cancelado');
    }

    // Cancelar agendamento
    const { data: cancelled } = await db
      .from('appointments')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('appointment_id', appointmentId)
      .eq('empresa_id', empresaId)
      .select()
      .single();

    return cancelled;
  }

  async listAppointments(empresaId: string, filters: { client_id?: string; status?: string; start_date?: string; end_date?: string }) {
    const db = this.supabase.getServiceRoleClient();

    let query = db
      .from('appointments')
      .select('*')
      .eq('empresa_id', empresaId);

    if (filters.client_id) {
      query = query.eq('client_id', filters.client_id);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.start_date) {
      query = query.gte('start_time', filters.start_date);
    }

    if (filters.end_date) {
      query = query.lte('end_time', filters.end_date);
    }

    const { data } = await query.order('start_time', { ascending: true });

    return { appointments: data || [] };
  }

  async listStaff(empresaId: string) {
    const db = this.supabase.getServiceRoleClient();

    const { data } = await db
      .from('staff')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
      .order('nome', { ascending: true });

    return { staff: data || [] };
  }

  async listServices(empresaId: string, activeOnly: boolean = true) {
    const db = this.supabase.getServiceRoleClient();

    let query = db
      .from('services')
      .select('*')
      .eq('empresa_id', empresaId);

    if (activeOnly) {
      query = query.eq('ativo', true);
    }

    const { data } = await query.order('nome', { ascending: true });

    // Processar URLs de imagem
    const servicesWithImages = data?.map(service => {
      let imageUrl = null;
      if (service.images && service.images.length > 0) {
        imageUrl = service.images[0];
      } else if (service.image_url) {
        imageUrl = service.image_url;
      }

      // Se tiver imagem e não for URL completa, gerar URL pública assumindo bucket 'services'
      // Ajuste conforme o bucket real caso saiba o nome correto
      if (imageUrl && !imageUrl.startsWith('http')) {
        const { data: publicUrlData } = db.storage.from('services').getPublicUrl(imageUrl);
        imageUrl = publicUrlData.publicUrl;
      }

      return {
        ...service,
        image_url: imageUrl // Campo unificado para a IA
      };
    }) || [];

    return { services: servicesWithImages };
  }

  async checkPaymentStatus(paymentId: string, empresaId: string) {
    const db = this.supabase.getServiceRoleClient();

    // Tentar buscar por payment_link_id primeiro
    let { data: paymentLink } = await db
      .from('payment_links')
      .select('*')
      .eq('payment_link_id', paymentId)
      .eq('empresa_id', empresaId)
      .single();

    // Se não encontrou, tentar por appointment_id
    if (!paymentLink) {
      const { data: appointment } = await db
        .from('appointments')
        .select('appointment_id')
        .eq('appointment_id', paymentId)
        .eq('empresa_id', empresaId)
        .single();

      if (appointment) {
        const { data: link } = await db
          .from('payment_links')
          .select('*')
          .eq('appointment_id', appointment.appointment_id)
          .eq('empresa_id', empresaId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        paymentLink = link;
      }
    }

    if (!paymentLink) {
      throw new NotFoundException('Pagamento não encontrado');
    }

    return {
      payment_link_id: paymentLink.payment_link_id,
      appointment_id: paymentLink.appointment_id,
      amount: paymentLink.amount,
      status: paymentLink.status,
      url: paymentLink.url,
      created_at: paymentLink.created_at,
    };
  }

  async listAvailabilityRules(empresaId: string) {
    const db = this.supabase.getServiceRoleClient();

    const { data, error } = await db
      .from('availability_rules')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('day_of_week')
      .order('start_time');

    if (error) {
      throw new BadRequestException('Erro ao listar regras de disponibilidade');
    }

    return data;
  }

  async createAvailabilityRule(dto: CreateAvailabilityRuleDto) {
    const db = this.supabase.getServiceRoleClient();

    const { data, error } = await db
      .from('availability_rules')
      .insert({
        empresa_id: dto.empresa_id,
        day_of_week: dto.day_of_week,
        start_time: dto.start_time,
        end_time: dto.end_time,
        staff_id: dto.staff_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating availability rule:', error);
      throw new BadRequestException(`Erro ao criar regra de disponibilidade: ${error.message}`);
    }

    return data;
  }

  async updateAvailabilityRule(ruleId: string, empresaId: string, dto: UpdateAvailabilityRuleDto) {
    const db = this.supabase.getServiceRoleClient();

    // Verificar se a regra existe e pertence à empresa
    const { data: existingRule, error: fetchError } = await db
      .from('availability_rules')
      .select('*')
      .eq('rule_id', ruleId)
      .eq('empresa_id', empresaId)
      .single();

    if (fetchError || !existingRule) {
      throw new NotFoundException('Regra de disponibilidade não encontrada');
    }

    // Validações
    if (dto.day_of_week !== undefined && (dto.day_of_week < 0 || dto.day_of_week > 6)) {
      throw new BadRequestException('day_of_week deve estar entre 0 (domingo) e 6 (sábado)');
    }

    const startTime = dto.start_time || existingRule.start_time;
    const endTime = dto.end_time || existingRule.end_time;

    if (startTime >= endTime) {
      throw new BadRequestException('start_time deve ser menor que end_time');
    }

    // Se staff_id for fornecido, verificar que o staff existe e está ativo
    if (dto.staff_id !== undefined && dto.staff_id !== null) {
      const { data: staff } = await db
        .from('staff')
        .select('staff_id, ativo')
        .eq('staff_id', dto.staff_id)
        .eq('empresa_id', empresaId)
        .single();

      if (!staff) {
        throw new NotFoundException('Profissional não encontrado');
      }

      if (!staff.ativo) {
        throw new BadRequestException('Profissional não está ativo');
      }
    }

    // Preparar dados para atualização
    const updateData: any = {};
    if (dto.day_of_week !== undefined) {
      updateData.day_of_week = dto.day_of_week;
    }
    if (dto.start_time !== undefined) {
      updateData.start_time = dto.start_time;
    }
    if (dto.end_time !== undefined) {
      updateData.end_time = dto.end_time;
    }
    if (dto.staff_id !== undefined) {
      updateData.staff_id = dto.staff_id || null;
    }

    // Atualizar regra
    const { data, error } = await db
      .from('availability_rules')
      .update(updateData)
      .eq('rule_id', ruleId)
      .eq('empresa_id', empresaId)
      .select()
      .single();

    if (error) {
      console.error('Error updating availability rule:', error);
      throw new BadRequestException(`Erro ao atualizar regra de disponibilidade: ${error.message}`);
    }

    return data;
  }

  async deleteAvailabilityRule(ruleId: string, empresaId: string) {
    const db = this.supabase.getServiceRoleClient();

    const { error } = await db
      .from('availability_rules')
      .delete()
      .eq('rule_id', ruleId)
      .eq('empresa_id', empresaId);

    if (error) {
      throw new BadRequestException('Erro ao deletar regra de disponibilidade');
    }

    return { success: true };
  }

  async createStaff(dto: any) {
    const db = this.supabase.getServiceRoleClient();
    const { data, error } = await db
      .from('staff')
      .insert({
        empresa_id: dto.empresa_id,
        nome: dto.nome,
        bio: dto.bio,
        especialidade: dto.especialidade,
        image_url: dto.image_url,
        ativo: dto.ativo ?? true,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException('Erro ao criar colaborador: ' + error.message);
    }

    return data;
  }

  async deleteStaff(id: string, empresaId: string) {
    const db = this.supabase.getServiceRoleClient();
    const { error } = await db
      .from('staff')
      .delete()
      .eq('staff_id', id)
      .eq('empresa_id', empresaId);

    if (error) {
      throw new BadRequestException('Erro ao deletar colaborador: ' + error.message);
    }

    return { success: true };
  }

  async getStaffServices(staffId: string, empresaId: string) {
    const db = this.supabase.getServiceRoleClient();

    // Verificar se o colaborador existe e pertence à empresa
    const { data: staffMember } = await db
      .from('staff')
      .select('staff_id')
      .eq('staff_id', staffId)
      .eq('empresa_id', empresaId)
      .single();

    if (!staffMember) {
      throw new NotFoundException('Colaborador não encontrado');
    }

    // Buscar serviços associados ao colaborador
    const { data: serviceStaff, error } = await db
      .from('service_staff')
      .select('service_id')
      .eq('staff_id', staffId)
      .eq('empresa_id', empresaId);

    if (error) {
      throw new BadRequestException('Erro ao buscar serviços do colaborador: ' + error.message);
    }

    const serviceIds = (serviceStaff || []).map((ss: any) => ss.service_id);

    // Buscar todos os serviços da empresa para retornar com flag de associado
    const { data: allServices } = await db
      .from('services')
      .select('service_id, nome, ativo')
      .eq('empresa_id', empresaId)
      .order('nome', { ascending: true });

    const services = (allServices || []).map((service: any) => ({
      service_id: service.service_id,
      nome: service.nome,
      ativo: service.ativo,
      associado: serviceIds.includes(service.service_id),
    }));

    return { services };
  }

  async updateStaffServices(staffId: string, empresaId: string, serviceIds: string[]) {
    const db = this.supabase.getServiceRoleClient();

    // Verificar se o colaborador existe e pertence à empresa
    const { data: staffMember } = await db
      .from('staff')
      .select('staff_id')
      .eq('staff_id', staffId)
      .eq('empresa_id', empresaId)
      .single();

    if (!staffMember) {
      throw new NotFoundException('Colaborador não encontrado');
    }

    // Remover todas as associações existentes
    const { error: deleteError } = await db
      .from('service_staff')
      .delete()
      .eq('staff_id', staffId)
      .eq('empresa_id', empresaId);

    if (deleteError) {
      throw new BadRequestException('Erro ao remover associações: ' + deleteError.message);
    }

    // Adicionar novas associações se houver serviços selecionados
    if (serviceIds && serviceIds.length > 0) {
      // Verificar se os serviços pertencem à empresa
      const { data: validServices } = await db
        .from('services')
        .select('service_id')
        .eq('empresa_id', empresaId)
        .in('service_id', serviceIds);

      const validServiceIds = (validServices || []).map((s: any) => s.service_id);

      if (validServiceIds.length > 0) {
        const associations = validServiceIds.map((serviceId: string) => ({
          service_id: serviceId,
          staff_id: staffId,
          empresa_id: empresaId,
        }));

        const { error: insertError } = await db
          .from('service_staff')
          .insert(associations);

        if (insertError) {
          throw new BadRequestException('Erro ao associar serviços: ' + insertError.message);
        }
      }
    }

    return { success: true, service_ids: serviceIds };
  }
}

