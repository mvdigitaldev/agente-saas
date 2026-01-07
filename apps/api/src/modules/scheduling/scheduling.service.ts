import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CreateBlockedTimeDto } from './dto/create-blocked-time.dto';
import { AvailableSlotsDto } from './dto/available-slots.dto';
import { PaymentLinkDto } from './dto/payment-link.dto';

@Injectable()
export class SchedulingService {
  constructor(private supabase: SupabaseService) { }

  async getAvailableSlots(dto: AvailableSlotsDto) {
    const db = this.supabase.getServiceRoleClient();

    // Buscar bloqueios no período
    const { data: blocks } = await db
      .from('blocked_times')
      .select('*')
      .eq('empresa_id', dto.empresa_id)
      .gte('start_time', dto.start_date)
      .lte('end_time', dto.end_date);

    // Buscar agendamentos no período
    const { data: appointments } = await db
      .from('appointments')
      .select('*')
      .eq('empresa_id', dto.empresa_id)
      .gte('start_time', dto.start_date)
      .lte('end_time', dto.end_date)
      .in('status', ['scheduled', 'confirmed']);

    // Calcular slots disponíveis (lógica simplificada)
    // TODO: Implementar lógica completa de disponibilidade

    return {
      available_slots: [],
      blocked_times: blocks || [],
      appointments: appointments || [],
    };
  }

  async createAppointment(dto: CreateAppointmentDto) {
    const db = this.supabase.getServiceRoleClient();

    // Verificar se não conflita com bloqueios
    const { data: conflictingBlock } = await db
      .from('blocked_times')
      .select('*')
      .eq('empresa_id', dto.empresa_id)
      .or(`start_time.lte.${dto.end_time},end_time.gte.${dto.start_time}`)
      .single();

    if (conflictingBlock) {
      throw new BadRequestException('Horário bloqueado');
    }

    const { data: appointment } = await db
      .from('appointments')
      .insert({
        empresa_id: dto.empresa_id,
        client_id: dto.client_id,
        service_id: dto.service_id,
        staff_id: dto.staff_id,
        resource_id: dto.resource_id,
        start_time: dto.start_time,
        end_time: dto.end_time,
        status: 'scheduled',
        notes: dto.notes,
      })
      .select()
      .single();

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
      .or(`start_time.lte.${data.end_time},end_time.gte.${data.start_time}`)
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
      .or(`start_time.lte.${data.end_time},end_time.gte.${data.start_time}`)
      .single();

    if (conflictingAppointment) {
      throw new BadRequestException('Novo horário conflita com outro agendamento');
    }

    // Atualizar agendamento
    const { data: updated } = await db
      .from('appointments')
      .update({
        start_time: data.start_time,
        end_time: data.end_time,
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
}

