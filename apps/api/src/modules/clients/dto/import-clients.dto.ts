import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateClientDto } from './create-client.dto';

export class ImportClientsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Deve haver pelo menos um cliente para importar' })
  @ValidateNested({ each: true })
  @Type(() => CreateClientDto)
  clients: CreateClientDto[];
}

