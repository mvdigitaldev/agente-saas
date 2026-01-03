import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { SignupDto } from './dto/signup.dto';
import { EmpresasService } from '../empresas/empresas.service';
import type { Request } from 'express';
import { createSupabaseClientFromRequest } from '../../common/helpers/supabase-request.helper';

@Injectable()
export class AuthService {
  constructor(
    private supabase: SupabaseService,
    private empresasService: EmpresasService,
  ) {}

  /**
   * Verifica o token do usuário usando o mesmo método do iAgenda
   * Cria um cliente Supabase a partir do request e usa getUser() sem parâmetros
   * que automaticamente pega o token do header Authorization
   */
  async verifyTokenFromRequest(req: Request) {
    const supabase = createSupabaseClientFromRequest(req);
    
    // getUser() sem parâmetros pega automaticamente do header Authorization
    const { data: userRes, error } = await supabase.auth.getUser();
    
    if (error || !userRes?.user) {
      throw new UnauthorizedException(`Token inválido: ${error?.message || 'Usuário não encontrado'}`);
    }

    return userRes.user;
  }

  async getEmpresaIdByUserId(userId: string) {
    const db = this.supabase.getServiceRoleClient();
    
    const { data, error } = await db
      .from('empresa_users')
      .select('empresa_id')
      .eq('user_id', userId)
      .single();

    if (error) {
      throw new Error(`Erro ao buscar empresa: ${error.message}`);
    }

    return data?.empresa_id || null;
  }

  async getMyEmpresa(userId: string) {
    const empresaId = await this.getEmpresaIdByUserId(userId);
    
    if (!empresaId) {
      return null;
    }

    return this.empresasService.getEmpresa(empresaId);
  }

  async signup(dto: SignupDto) {
    const client = this.supabase.getClient();
    const db = this.supabase.getServiceRoleClient();

    // 1. Criar usuário no Supabase Auth
    const { data: authData, error: authError } = await client.auth.signUp({
      email: dto.email,
      password: dto.password,
      options: {
        data: {
          nome: dto.nome,
        },
      },
    });

    if (authError) {
      throw new BadRequestException(`Erro ao criar usuário: ${authError.message}`);
    }

    if (!authData.user) {
      throw new BadRequestException('Falha ao criar usuário');
    }

    // 2. Criar empresa
    const { data: empresa, error: empresaError } = await db
      .from('empresas')
      .insert({
        nome: dto.empresa_nome,
        email: dto.email,
        cnpj: dto.empresa_cnpj,
      })
      .select()
      .single();

    if (empresaError) {
      throw new BadRequestException(`Erro ao criar empresa: ${empresaError.message}`);
    }

    // 3. Criar registro na tabela users
    const { error: userError } = await db.from('users').insert({
      user_id: authData.user.id,
      email: dto.email,
      nome: dto.nome,
    });

    if (userError) {
      console.error('Erro ao criar registro em users:', userError);
    }

    // 4. Vincular usuário à empresa (owner)
    const { error: linkError } = await db.from('empresa_users').insert({
      empresa_id: empresa.empresa_id,
      user_id: authData.user.id,
      role: 'owner',
    });

    if (linkError) {
      throw new BadRequestException(`Erro ao vincular usuário: ${linkError.message}`);
    }

    // 5. Criar configurações padrão do agente
    await db.from('agent_configs').insert({
      empresa_id: empresa.empresa_id,
      tone: 'Amigável e profissional',
      rules: '',
      policies: {},
    });

    await db.from('agent_features').insert({
      empresa_id: empresa.empresa_id,
      ask_for_pix: false,
      require_deposit: false,
      auto_confirmations_48h: true,
      auto_confirmations_24h: true,
      auto_confirmations_2h: true,
      waitlist_enabled: false,
      marketing_campaigns: false,
    });

    return {
      user: authData.user,
      empresa: empresa,
      session: authData.session,
    };
  }
}

