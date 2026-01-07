import { IsOptional, Allow } from 'class-validator';

/**
 * DTO flexível para receber webhooks da Uazapi
 * A Uazapi envia diferentes estruturas dependendo do tipo de evento
 * Usamos @Allow() para aceitar qualquer propriedade sem validação estrita
 */
export class UazapiWebhookDto {
  @Allow()
  @IsOptional()
  id?: string;

  @Allow()
  @IsOptional()
  messageId?: string;

  @Allow()
  @IsOptional()
  instance_id?: string;

  @Allow()
  @IsOptional()
  from?: string;

  @Allow()
  @IsOptional()
  to?: string;

  @Allow()
  @IsOptional()
  body?: string;

  @Allow()
  @IsOptional()
  text?: string;

  @Allow()
  @IsOptional()
  type?: string;

  @Allow()
  @IsOptional()
  event?: string;

  @Allow()
  @IsOptional()
  data?: any;

  @Allow()
  @IsOptional()
  message?: any;

  @Allow()
  @IsOptional()
  notifyName?: string;

  @Allow()
  @IsOptional()
  senderName?: string;

  @Allow()
  @IsOptional()
  pushName?: string;

  @Allow()
  @IsOptional()
  isGroup?: boolean;

  @Allow()
  @IsOptional()
  timestamp?: number;

  // Permite qualquer outra propriedade não listada
  [key: string]: any;
}

