import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

@Injectable()
export class CrmService {
  constructor(private supabase: SupabaseService) {}

  async getClientProfile(empresaId: string, clientId: string) {
    const db = this.supabase.getServiceRoleClient();

    const { data } = await db
      .from('client_profiles')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('client_id', clientId)
      .single();

    return data;
  }
}

