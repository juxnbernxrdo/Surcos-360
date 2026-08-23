import {
  IsEmail,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsArray,
  IsString,
  IsIn,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrganizationRole } from '@prisma/client';
import { ALL_ORG_PERMISSIONS } from '../constants/permissions.constant';

export class CreateOrganizationInvitationDto {
  @IsEmail({}, { message: 'El correo electrónico debe ser válido' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  email: string;

  @IsOptional()
  @IsEnum(OrganizationRole, {
    message: 'El rol debe ser ADMIN o USER',
  })
  role?: OrganizationRole = OrganizationRole.USER;

  @IsOptional()
  @IsArray({ message: 'Los permisos deben ser un arreglo de cadenas' })
  @IsString({ each: true })
  @IsIn(ALL_ORG_PERMISSIONS, {
    each: true,
    message: 'Uno o más permisos especificados no son válidos',
  })
  permissions?: string[] = [];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'La vigencia mínima es de 1 día' })
  @Max(30, { message: 'La vigencia máxima es de 30 días' })
  expiresInDays?: number = 7;
}
