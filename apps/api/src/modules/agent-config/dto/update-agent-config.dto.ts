import { IsString, IsOptional, IsObject } from 'class-validator';

export class UpdateAgentConfigDto {
  @IsString()
  @IsOptional()
  tone?: string;

  @IsString()
  @IsOptional()
  rules?: string;

  @IsObject()
  @IsOptional()
  policies?: Record<string, any>;
}

