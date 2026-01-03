import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CreateBlockedTimeDto } from './dto/create-blocked-time.dto';
import { AvailableSlotsDto } from './dto/available-slots.dto';
import { PaymentLinkDto } from './dto/payment-link.dto';

@Injectable()
export class SchedulingService {
  constructor(private supabase: SupabaseService) {}

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
}

