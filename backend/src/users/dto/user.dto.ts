import { IsString, IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { InstitutionStatus, UserType } from '@prisma/client';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;
}

export class UpdateUserStatusDto {
  @IsEnum(InstitutionStatus)
  status: InstitutionStatus;
}

export class QueryUsersDto {
  @IsOptional()
  @IsEnum(UserType)
  userType?: UserType;

  @IsOptional()
  @IsEnum(InstitutionStatus)
  status?: InstitutionStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

export class LinkIdentityDto {
  @IsString()
  institutionalPersonId: string;

  @IsString()
  userId: string;
}
