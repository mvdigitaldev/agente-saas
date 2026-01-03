import { IsString, IsOptional, IsArray } from 'class-validator';

export class ButtonDto {
  @IsString()
  id: string;

  @IsString()
  text: string;
}

export class SendMessageDto {
  @IsString()
  empresa_id: string;

  @IsString()
  @IsOptional()
  conversation_id?: string;

  @IsString()
  @IsOptional()
  phone_number?: string;

  @IsString()
  message: string;

  @IsArray()
  @IsOptional()
  buttons?: ButtonDto[];
}

