import { IsString, IsOptional, IsEmail, Matches } from 'class-validator';

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, {
    message: 'whatsapp_number deve conter apenas dígitos (sem formatação)',
  })
  whatsapp_number?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

