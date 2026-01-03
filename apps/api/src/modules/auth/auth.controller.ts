import { Controller, Post, Body, Get, Req, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import type { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Get('me/empresa')
  async getMyEmpresa(@Req() req: Request) {
    // Verificar se há token no header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token não fornecido');
    }

    // Usar o mesmo método do iAgenda: criar cliente a partir do request
    const user = await this.authService.verifyTokenFromRequest(req);
    
    if (!user) {
      throw new UnauthorizedException('Token inválido');
    }

    const empresaId = await this.authService.getEmpresaIdByUserId(user.id);
    
    return { empresa_id: empresaId };
  }
}

