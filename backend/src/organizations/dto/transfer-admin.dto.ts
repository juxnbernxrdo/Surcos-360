import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class TransferAdminDto {
  @IsString({
    message: 'El ID del nuevo administrador debe ser una cadena válida',
  })
  @IsNotEmpty({ message: 'El ID del nuevo administrador es obligatorio' })
  newAdminPersonId: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
