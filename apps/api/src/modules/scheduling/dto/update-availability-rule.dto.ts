import { IsOptional, IsInt, IsString, Min, Max, Matches } from 'class-validator';

export class UpdateAvailabilityRuleDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  day_of_week?: number;

  @IsOptional()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'start_time deve estar no formato HH:MM (ex: 09:00)',
  })
  start_time?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'end_time deve estar no formato HH:MM (ex: 18:00)',
  })
  end_time?: string;

  @IsOptional()
  staff_id?: string | null;
}

