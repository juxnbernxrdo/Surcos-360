import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { RentalStatus } from '@prisma/client';
import { IsMoney } from '../../common/money';

export class CreateRentalDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsOptional()
  @IsString()
  assetId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  @IsNotEmpty()
  itemName: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  @IsOptional()
  durationHours?: number = 1.0;

  @IsMoney()
  hourlyRate: string;
}

export class ReturnRentalDto {
  @IsOptional()
  @IsEnum(RentalStatus)
  status?: RentalStatus = RentalStatus.RETURNED;
}

export class QueryRentalsDto {
  @IsOptional()
  @IsEnum(RentalStatus)
  status?: RentalStatus;

  @IsOptional()
  page?: number = 1;

  @IsOptional()
  limit?: number = 20;
}
