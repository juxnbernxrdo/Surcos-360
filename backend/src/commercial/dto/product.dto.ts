import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
  Min,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductType, ProductStatus, MovementType } from '@prisma/client';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  sku: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  category: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  unit: string; // e.g. "UNIT", "KG", "LITER", "PACKAGE", "HOUR"

  @IsEnum(ProductType)
  @IsOptional()
  type?: ProductType;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  salePrice: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  initialCost?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  initialStock?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  minStock?: number;
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  @MaxLength(150)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  unit?: string;

  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @IsOptional()
  salePrice?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  minStock?: number;
}

export class AdjustInventoryDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @Type(() => Number)
  @IsNumber()
  quantity: number; // Positive or negative delta

  @IsEnum(MovementType)
  @IsOptional()
  type?: MovementType; // ADJUSTMENT, LOSS, RETURN

  @IsString()
  @IsOptional()
  @MaxLength(255)
  reason?: string;
}

export class QueryProductsDto {
  @IsString()
  @IsOptional()
  category?: string;

  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;

  @IsString()
  @IsOptional()
  search?: string;

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
