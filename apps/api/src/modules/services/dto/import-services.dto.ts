import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateServiceDto } from './create-service.dto';

export class ImportServicesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateServiceDto)
  services: CreateServiceDto[];
}
