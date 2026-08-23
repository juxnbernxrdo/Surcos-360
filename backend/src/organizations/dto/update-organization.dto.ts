import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsObject,
} from 'class-validator';

export class UpdateOrganizationDto {
  @IsString()
  @IsOptional()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'La descripción no puede exceder 500 caracteres' })
  description?: string;

  @IsObject()
  @IsOptional()
  settings?: Record<string, unknown>;
}
