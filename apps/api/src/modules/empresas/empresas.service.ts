import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { CreateEmpresaDto } from './dto/create-empresa.dto';

@Injectable()
export class EmpresasService {
  constructor(private supabase: SupabaseService) {}

  async getEmpresa(id: string) {
    const db = this.supabase.getServiceRoleClient();

    const { data } = await db
      .from('empresas')
      .select('*')
      .eq('empresa_id', id)
      .single();

    return data;
  }

  async createEmpresa(dto: CreateEmpresaDto) {
    const db = this.supabase.getServiceRoleClient();

    const { data } = await db
      .from('empresas')
      .insert(dto)
      .select()
      .single();

    return data;
  }
}

