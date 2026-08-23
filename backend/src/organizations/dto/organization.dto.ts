import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
} from 'class-validator';
import { OrganizationRole } from '@prisma/client';

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isPyme?: boolean = true;
}

export class AddMemberDto {
  @IsString()
  @IsNotEmpty()
  institutionalPersonId: string;

  @IsEnum(OrganizationRole)
  role: OrganizationRole = OrganizationRole.USER;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[] = [];
}

export class UpdateMemberRoleDto {
  @IsOptional()
  @IsEnum(OrganizationRole)
  role?: OrganizationRole;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}
