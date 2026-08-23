import { IsString, IsOptional, IsEnum } from 'class-validator';
import { VisitType, VisitStatus } from '@prisma/client';
import { IsMoney } from '../../common/money';

export class CreateGymVisitDto {
  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsEnum(VisitType)
  @IsOptional()
  visitType?: VisitType = VisitType.FREE;

  @IsOptional()
  @IsMoney()
  amount?: string = '0.00';

  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryGymVisitsDto {
  @IsOptional()
  @IsEnum(VisitType)
  visitType?: VisitType;

  @IsOptional()
  @IsEnum(VisitStatus)
  status?: VisitStatus;

  @IsOptional()
  page?: number = 1;

  @IsOptional()
  limit?: number = 20;
}
