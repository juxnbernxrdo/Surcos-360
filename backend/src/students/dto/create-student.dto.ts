import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsNumber,
  Min,
  ValidateNested,
  IsArray,
  MaxLength,
  ArrayMinSize,
  ArrayMaxSize,
  IsEnum,
  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { InstitutionStatus } from '@prisma/client';

export class CreateStudentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  lastName: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_\-.]+$/, {
    message:
      'institutionalCode must contain only alphanumeric characters, underscores, hyphens or dots',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  institutionalCode: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  course: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  tutor?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  academicYear?: string;

  @IsNumber()
  @Min(0, { message: 'Initial balance cannot be negative' })
  @IsOptional()
  @Type(() => Number)
  initialBalance?: number;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  institutionId?: string;
}

export class BulkImportStudentsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Import list must contain at least 1 student' })
  @ArrayMaxSize(500, {
    message: 'Import list cannot exceed 500 students per batch',
  })
  @ValidateNested({ each: true })
  @Type(() => CreateStudentDto)
  students: CreateStudentDto[];
}

export class UpdateStudentDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  firstName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  lastName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  course?: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  tutor?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  academicYear?: string;
}

export class UpdateAcademicDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  course: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  tutor?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  academicYear?: string;
}

export class UpdateStudentStatusDto {
  @IsEnum(InstitutionStatus, {
    message: 'status must be ACTIVE, INACTIVE, or SUSPENDED',
  })
  @IsNotEmpty()
  status: InstitutionStatus;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  reason?: string;
}

export class LookupStudentDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  code?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  email?: string;
}
