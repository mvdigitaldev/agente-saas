import { IsString, IsOptional, IsDateString } from 'class-validator';

export class CreateAppointmentDto {
  @IsString()
  empresa_id: string;

  @IsString()
  client_id: string;

  @IsString()
  service_id: string;

  @IsString()
  @IsOptional()
  staff_id?: string;

  @IsString()
  @IsOptional()
  resource_id?: string;

  @IsDateString()
  start_time: string;

  @IsDateString()
  end_time: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

