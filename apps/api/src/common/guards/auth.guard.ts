import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { createSupabaseClientFromRequest } from '../helpers/supabase-request.helper';
import { SupabaseService } from '../../database/supabase.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Verificar se há token no header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token não fornecido');
    }

    try {
      // Criar cliente Supabase a partir do request
      const supabaseClient = createSupabaseClientFromRequest(request);

      // getUser() sem parâmetros pega automaticamente do header Authorization
      const { data: userRes, error } = await supabaseClient.auth.getUser();

      if (error || !userRes?.user) {
        throw new UnauthorizedException(`Token inválido: ${error?.message || 'Usuário não encontrado'}`);
      }

      // Buscar empresa_id do usuário
      const db = this.supabase.getServiceRoleClient();
      const { data: empresaUser } = await db
        .from('empresa_users')
        .select('empresa_id')
        .eq('user_id', userRes.user.id)
        .single();

      // Adicionar user e empresa_id ao request para uso nos controllers
      request.user = {
        id: userRes.user.id,
        email: userRes.user.email,
        empresa_id: empresaUser?.empresa_id || null,
      };

      return true;
    } catch (error: any) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Erro ao verificar autenticação');
    }
  }
}
