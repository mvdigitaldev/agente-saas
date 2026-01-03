import { IsString, IsDateString, IsOptional } from 'class-validator';

export class CreateBlockedTimeDto {
  @IsString()
  empresa_id: string;

  @IsDateString()
  start_time: string;

  @IsDateString()
  end_time: string;

  @IsString()
  @IsOptional()
  motivo?: string;

  @IsString()
  @IsOptional()
  staff_id?: string;

  @IsString()
  @IsOptional()
  resource_id?: string;

  @IsString()
  @IsOptional()
  created_by?: string;
}

