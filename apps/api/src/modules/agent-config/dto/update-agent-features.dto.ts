import { IsBoolean, IsOptional, IsNumber, Min, Max } from 'class-validator';

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

  @IsBoolean()
  @IsOptional()
  send_media_enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  use_service_images?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(10)
  max_tool_iterations?: number;

  @IsBoolean()
  @IsOptional()
  auto_send_service_images?: boolean;
}

