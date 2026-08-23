import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ReverseTransactionDto {
  @IsString()
  @IsNotEmpty({
    message: 'El motivo de la anulación o reversión es obligatorio.',
  })
  reason: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
