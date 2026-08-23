import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { IsMoney } from '../../common/money';

export class CreateExpenseDto {
  @IsString()
  @IsNotEmpty()
  category: string; // e.g. "UTILITIES", "MAINTENANCE", "SUPPLIES", "TRANSPORT", "MARKETING"

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsMoney()
  amount: string;

  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod = PaymentMethod.CASH;

  @IsString()
  @IsOptional()
  referenceNumber?: string;
}

export class QueryExpensesDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  page?: number = 1;

  @IsOptional()
  limit?: number = 20;
}
