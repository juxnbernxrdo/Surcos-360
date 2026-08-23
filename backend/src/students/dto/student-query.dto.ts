import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsIn,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { InstitutionStatus } from '@prisma/client';

export class StudentQueryDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  course?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  search?: string;

  @IsOptional()
  @IsEnum(InstitutionStatus)
  status?: InstitutionStatus;

  @IsOptional()
  @IsString()
  institutionId?: string;

  @IsOptional()
  @IsIn(['createdAt', 'lastName', 'firstName', 'course'])
  sortBy?: 'createdAt' | 'lastName' | 'firstName' | 'course' = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc', 'ASC', 'DESC'])
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
