import { IsString, IsEmail, IsOptional } from 'class-validator';

export class CreateEmpresaDto {
  @IsString()
  nome: string;

  @IsString()
  @IsOptional()
  cnpj?: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  telefone?: string;
}

