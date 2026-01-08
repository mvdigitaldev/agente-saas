import { IsString, IsOptional } from 'class-validator';

export class AvailableSlotsDto {
  @IsString()
  empresa_id: string;

  @IsString()
  @IsOptional()
  service_id?: string;

  @IsString()
  @IsOptional()
  staff_id?: string;

  @IsString()
  @IsOptional()
  resource_id?: string;

  @IsString()
  start_date: string;

  @IsString()
  @IsOptional()
  end_date?: string;
}

