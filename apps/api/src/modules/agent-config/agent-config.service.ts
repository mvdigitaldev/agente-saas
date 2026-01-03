import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { UpdateAgentConfigDto } from './dto/update-agent-config.dto';
import { UpdateAgentFeaturesDto } from './dto/update-agent-features.dto';

@Injectable()
export class AgentConfigService {
  constructor(private supabase: SupabaseService) {}

  async getConfig(empresaId: string) {
    const db = this.supabase.getServiceRoleClient();

    const { data } = await db
      .from('agent_configs')
      .select('*')
      .eq('empresa_id', empresaId)
      .single();

    return data;
  }

  async updateConfig(empresaId: string, dto: UpdateAgentConfigDto) {
    const db = this.supabase.getServiceRoleClient();

    const { data } = await db
      .from('agent_configs')
      .upsert(
        {
          empresa_id: empresaId,
          ...dto,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'empresa_id',
        },
      )
      .select()
      .single();

    return data;
  }

  async getFeatures(empresaId: string) {
    const db = this.supabase.getServiceRoleClient();

    const { data } = await db
      .from('agent_features')
      .select('*')
      .eq('empresa_id', empresaId)
      .single();

    return data;
  }

  async updateFeatures(empresaId: string, dto: UpdateAgentFeaturesDto) {
    const db = this.supabase.getServiceRoleClient();

    const { data } = await db
      .from('agent_features')
      .upsert(
        {
          empresa_id: empresaId,
          ...dto,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'empresa_id',
        },
      )
      .select()
      .single();

    return data;
  }
}

