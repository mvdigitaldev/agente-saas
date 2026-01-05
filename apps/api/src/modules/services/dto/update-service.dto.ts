import { IsString, IsOptional, IsNumber, IsBoolean, Min, MaxLength } from 'class-validator';
import { CreateServiceDto } from './create-service.dto';

// Como alternativa ao PartialType, definimos manualmente todos os campos como opcionais
export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descricao?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  preco?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  duracao_minutos?: number;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsBoolean()
  available_online?: boolean;

  @IsOptional()
  @IsBoolean()
  show_price_online?: boolean;

  @IsOptional()
  @IsBoolean()
  fixed_price?: boolean;

  @IsOptional()
  @IsString()
  created_by?: string;
}
