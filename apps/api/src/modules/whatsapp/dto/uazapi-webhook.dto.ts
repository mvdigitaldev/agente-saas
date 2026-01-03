import { IsString, IsOptional, IsObject } from 'class-validator';

export class UazapiWebhookDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  messageId?: string;

  @IsString()
  from: string;

  @IsString()
  @IsOptional()
  to?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsString()
  @IsOptional()
  text?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsObject()
  @IsOptional()
  data?: any;
}

