import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsString,
  IsIn,
} from 'class-validator';
import { OrganizationRole } from '@prisma/client';
import { ALL_ORG_PERMISSIONS } from '../constants/permissions.constant';

export class AddDirectMemberDto {
  @IsString({
    message: 'El ID de la persona institucional debe ser una cadena válida',
  })
  @IsNotEmpty({ message: 'El ID de la persona institucional es obligatorio' })
  institutionalPersonId: string;

  @IsOptional()
  @IsEnum(OrganizationRole, { message: 'El rol debe ser ADMIN o USER' })
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
  @IsString()
  notes?: string;
}
