import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { LiabilityType, LiabilityStatus } from '@prisma/client';
import { IsMoney } from '../../common/money';

export class CreateLiabilityDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsEnum(LiabilityType)
  @IsOptional()
  type?: LiabilityType = LiabilityType.ACCOUNTS_PAYABLE;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsOptional()
  supplierId?: string;

  @IsMoney()
  initialAmount: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdateLiabilityDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(LiabilityStatus)
  status?: LiabilityStatus;

  @IsMoney()
  @IsOptional()
  outstandingBalance?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class QueryLiabilitiesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(LiabilityType)
  type?: LiabilityType;

  @IsOptional()
  @IsEnum(LiabilityStatus)
  status?: LiabilityStatus;

  @IsOptional()
  page?: number = 1;

  @IsOptional()
  limit?: number = 20;
}
