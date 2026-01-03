import { IsString, IsOptional } from 'class-validator';

export class AvailableSlotsDto {
  @IsString()
  empresa_id: string;

  @IsString()
  @IsOptional()
  service_id?: string;

  @IsString()
  start_date: string;

  @IsString()
  end_date: string;
}

