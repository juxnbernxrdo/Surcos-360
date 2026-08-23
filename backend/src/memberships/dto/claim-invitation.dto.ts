import { IsNotEmpty, IsString } from 'class-validator';

export class ClaimInvitationDto {
  @IsString({ message: 'El token de invitación debe ser una cadena válida' })
  @IsNotEmpty({ message: 'El token de invitación es obligatorio' })
  token: string;
}
