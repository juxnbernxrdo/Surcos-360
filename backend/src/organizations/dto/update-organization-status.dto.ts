import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { OrganizationStatus } from '@prisma/client';

export class UpdateOrganizationStatusDto {
  @IsEnum(OrganizationStatus, {
    message: 'El estado debe ser ACTIVE, INACTIVE o SUSPENDED',
  })
  @IsNotEmpty({ message: 'El estado es obligatorio' })
  status: OrganizationStatus;

  @IsString()
  @IsOptional()
  reason?: string;
}
