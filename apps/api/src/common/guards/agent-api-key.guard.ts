import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class AgentApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-agent-api-key'];
    const expectedKey = process.env.AGENT_API_KEY;

    if (!expectedKey) {
      throw new Error('AGENT_API_KEY not configured');
    }

    if (apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid agent API key');
    }

    return true;
  }
}

