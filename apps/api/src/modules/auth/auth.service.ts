import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

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
}

