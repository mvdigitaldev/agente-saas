import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

@Injectable()
export class MetricsService {
  constructor(private supabase: SupabaseService) {}

  async getDailyMetrics(empresaId: string, date: string) {
    const db = this.supabase.getServiceRoleClient();

    const { data } = await db
      .from('metrics_daily')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('date', date)
      .single();

    return data;
  }
}

