import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

@Injectable()
export class ClientsService {
  constructor(private supabase: SupabaseService) {}

  async getClient(empresaId: string, clientId: string) {
    const db = this.supabase.getServiceRoleClient();

    const { data } = await db
      .from('clients')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('client_id', clientId)
      .single();

    return data;
  }
}

