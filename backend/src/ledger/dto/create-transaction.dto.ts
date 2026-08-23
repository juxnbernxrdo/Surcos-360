import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EntryDirection, TransactionType } from '@prisma/client';
import { IsMoney } from '../../common/money';

export class LedgerEntryItemDto {
  @IsOptional()
  @IsString()
  studentAccountId?: string;

  @IsOptional()
  @IsString()
  ledgerAccountId?: string;

  @IsEnum(EntryDirection, {
    message: 'La dirección del asiento debe ser DEBIT o CREDIT.',
  })
  direction: EntryDirection;

  @IsMoney()
  amount: string;
}

export class CreateTransactionDto {
  @IsEnum(TransactionType, {
    message: 'El tipo de transacción proporcionado no es válido.',
  })
  type: TransactionType;

  @IsString()
  @IsNotEmpty({ message: 'La descripción de la transacción es obligatoria.' })
  description: string;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsArray()
  @ArrayMinSize(2, {
    message:
      'Una transacción de partida doble requiere al menos 2 asientos contables.',
  })
  @ValidateNested({ each: true })
  @Type(() => LedgerEntryItemDto)
  entries: LedgerEntryItemDto[];
}
