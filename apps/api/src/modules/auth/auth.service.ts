import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(private supabase: SupabaseService) {}

  async verifyToken(token: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client.auth.getUser(token);

    if (error) {
      throw new Error('Invalid token');
    }

    return data.user;
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

