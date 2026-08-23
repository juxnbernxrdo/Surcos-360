import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { AccountType } from '@prisma/client';

export class CreateLedgerAccountDto {
  @IsString()
  @IsNotEmpty({ message: 'El código de cuenta es obligatorio.' })
  code: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre de cuenta es obligatorio.' })
  name: string;

  @IsEnum(AccountType, {
    message:
      'El tipo de cuenta debe ser ASSET, LIABILITY, EQUITY, REVENUE o EXPENSE.',
  })
  type: AccountType;

  @IsOptional()
  @IsString()
  organizationId?: string;
}
