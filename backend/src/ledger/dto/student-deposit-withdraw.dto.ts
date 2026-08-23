import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { IsMoney } from '../../common/money';

export class StudentDepositDto {
  @IsMoney()
  amount: string;

  @IsString()
  @IsNotEmpty({
    message: 'El concepto o descripción del depósito es obligatorio.',
  })
  description: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class StudentWithdrawalDto {
  @IsMoney()
  amount: string;

  @IsString()
  @IsNotEmpty({ message: 'El concepto o motivo del retiro es obligatorio.' })
  description: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
