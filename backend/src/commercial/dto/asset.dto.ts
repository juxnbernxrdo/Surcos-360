import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { AssetType, AssetStatus } from '@prisma/client';
import { IsMoney } from '../../common/money';

export class CreateAssetDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  serialNumber?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(AssetType)
  @IsOptional()
  type?: AssetType = AssetType.EQUIPMENT;

  @IsMoney()
  acquisitionCost: string;

  @IsMoney()
  @IsOptional()
  currentValuation?: string;

  @IsString()
  @IsOptional()
  physicalLocation?: string;

  @IsString()
  @IsOptional()
  responsibleId?: string;

  @IsBoolean()
  @IsOptional()
  isAvailableForSale?: boolean = false;

  @IsMoney()
  @IsOptional()
  salePrice?: string;
}

export class UpdateAssetDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(AssetType)
  @IsOptional()
  type?: AssetType;

  @IsEnum(AssetStatus)
  @IsOptional()
  status?: AssetStatus;

  @IsMoney()
  @IsOptional()
  currentValuation?: string;

  @IsString()
  @IsOptional()
  physicalLocation?: string;

  @IsString()
  @IsOptional()
  responsibleId?: string;

  @IsBoolean()
  @IsOptional()
  isAvailableForSale?: boolean;

  @IsMoney()
  @IsOptional()
  salePrice?: string;
}

export class QueryAssetsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(AssetType)
  type?: AssetType;

  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @IsOptional()
  @IsBoolean()
  isAvailableForSale?: boolean;

  @IsOptional()
  page?: number = 1;

  @IsOptional()
  limit?: number = 20;
}
