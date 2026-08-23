import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { MembershipStatus } from '@prisma/client';

export class UpdateMembershipStatusDto {
  @IsEnum(MembershipStatus, {
    message: 'El estado debe ser ACTIVE, SUSPENDED o REVOKED',
  })
  @IsNotEmpty({ message: 'El estado de la membresía es obligatorio' })
  status: MembershipStatus;

  @IsString()
  @IsOptional()
  reason?: string;
}
