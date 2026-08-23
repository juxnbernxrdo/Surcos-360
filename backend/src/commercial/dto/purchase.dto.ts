import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsEnum,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PurchaseStatus } from '@prisma/client';

export class PurchaseItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  unitCost: number;
}

export class CreatePurchaseDto {
  @IsString()
  @IsNotEmpty()
  supplierId: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  invoiceNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  paymentTerms?: string; // "CONTADO", "CREDITO_30", etc.

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];
}

export class QueryPurchasesDto {
  @IsString()
  @IsOptional()
  supplierId?: string;

  @IsEnum(PurchaseStatus)
  @IsOptional()
  status?: PurchaseStatus;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
