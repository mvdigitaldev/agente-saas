import { IsString, IsNumber } from 'class-validator';

export class PaymentLinkDto {
  @IsString()
  empresa_id: string;

  @IsString()
  appointment_id: string;

  @IsNumber()
  amount: number;
}

