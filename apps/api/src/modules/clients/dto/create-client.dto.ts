import { IsString, IsOptional, IsEmail, Matches } from 'class-validator';

export class CreateClientDto {
  @IsString()
  nome: string;

  @IsString()
  @Matches(/^\d+$/, {
    message: 'whatsapp_number deve conter apenas dígitos (sem formatação)',
  })
  whatsapp_number: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

