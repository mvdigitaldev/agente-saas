import { IsString, IsEmail, IsOptional } from 'class-validator';

export class SignupDto {
  @IsString()
  nome: string;

  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsString()
  empresa_nome: string;

  @IsString()
  @IsOptional()
  empresa_cnpj?: string;
}

