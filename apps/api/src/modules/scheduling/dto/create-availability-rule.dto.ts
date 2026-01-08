import { IsString, IsNumber, IsOptional, Matches } from 'class-validator';

export class CreateAvailabilityRuleDto {
  @IsString()
  empresa_id: string;

  @IsNumber()
  day_of_week: number;

  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'start_time must be in HH:MM format' })
  start_time: string;

  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'end_time must be in HH:MM format' })
  end_time: string;

  @IsString()
  @IsOptional()
  staff_id?: string;
}
