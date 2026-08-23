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
import { PaymentMethod, SaleStatus } from '@prisma/client';

export class SaleItemDto {
  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  assetId?: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @IsOptional()
  unitPrice?: number; // Opcional: toma Product.salePrice o Asset.salePrice si no se provee
}

export class CreateSaleDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod = PaymentMethod.STUDENT_ACCOUNT;

  @IsString()
  @IsOptional()
  studentAccountId?: string;

  @IsString()
  @IsOptional()
  revenueAccountId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  invoiceNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];
}

export class QuerySalesDto {
  @IsString()
  @IsOptional()
  customerId?: string;

  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @IsEnum(SaleStatus)
  @IsOptional()
  status?: SaleStatus;

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
