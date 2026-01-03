import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateAgentFeaturesDto {
  @IsBoolean()
  @IsOptional()
  ask_for_pix?: boolean;

  @IsBoolean()
  @IsOptional()
  require_deposit?: boolean;

  @IsBoolean()
  @IsOptional()
  auto_confirmations_48h?: boolean;

  @IsBoolean()
  @IsOptional()
  auto_confirmations_24h?: boolean;

  @IsBoolean()
  @IsOptional()
  auto_confirmations_2h?: boolean;

  @IsBoolean()
  @IsOptional()
  waitlist_enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  marketing_campaigns?: boolean;
}

