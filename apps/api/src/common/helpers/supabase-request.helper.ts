import type { Request } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Cria um cliente Supabase a partir do token no header Authorization do request
 * Similar ao createSupabaseClientWithCookies do iAgenda, mas usando apenas header Authorization
 */
export function createSupabaseClientFromRequest(req: Request): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'SUPABASE_URL e SUPABASE_ANON_KEY devem estar configuradas.',
    );
  }

  // Extrair token do header Authorization
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') 
    ? authHeader.replace('Bearer ', '') 
    : null;

  // Criar cliente com o token no header
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: token ? {
        Authorization: `Bearer ${token}`,
      } : {},
    },
  });

  return client;
}

