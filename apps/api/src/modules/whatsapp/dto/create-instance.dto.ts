import { IsString, IsOptional } from 'class-validator';

export class CreateInstanceDto {
  @IsString()
  empresa_id: string;

  @IsString()
  @IsOptional()
  instance_name?: string;
}

