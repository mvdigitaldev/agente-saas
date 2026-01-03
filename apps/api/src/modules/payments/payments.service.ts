import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

@Injectable()
export class PaymentsService {
  constructor(private supabase: SupabaseService) {}

  async getPayment(empresaId: string, paymentId: string) {
    const db = this.supabase.getServiceRoleClient();

    const { data } = await db
      .from('payments')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('payment_id', paymentId)
      .single();

    return data;
  }
}

