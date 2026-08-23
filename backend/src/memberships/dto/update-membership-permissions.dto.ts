import { IsArray, IsIn, IsNotEmpty, IsString } from 'class-validator';
import { ALL_ORG_PERMISSIONS } from '../../organizations/constants/permissions.constant';

export class UpdateMembershipPermissionsDto {
  @IsArray({ message: 'Los permisos deben ser una lista de cadenas' })
  @IsString({ each: true })
  @IsIn(ALL_ORG_PERMISSIONS, {
    each: true,
    message: 'Uno o más permisos no son válidos para la organización',
  })
  @IsNotEmpty({ message: 'La lista de permisos no puede estar vacía' })
  permissions: string[];
}
