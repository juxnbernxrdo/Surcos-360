import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  MinLength,
  MaxLength,
  Matches,
  IsObject,
} from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la organización es obligatorio' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'El código de la organización es obligatorio' })
  @MinLength(2, { message: 'El código debe tener al menos 2 caracteres' })
  @MaxLength(20, { message: 'El código no puede exceder 20 caracteres' })
  @Matches(/^[A-Z0-9_-]+$/, {
    message:
      'El código solo puede contener letras mayúsculas, números, guiones y guiones bajos',
  })
  code: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'La descripción no puede exceder 500 caracteres' })
  description?: string;

  @IsBoolean()
  @IsOptional()
  isPyme?: boolean = true;

  @IsObject()
  @IsOptional()
  settings?: Record<string, unknown>;
}
