import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @IsOptional()
  @IsString()
  @MaxLength(256)
  token?: string;

  @IsEmail({}, { message: 'A valid institutional email address is required' })
  @Transform(({ value }: { value: unknown }): string =>
    typeof value === 'string' ? value.trim().toLowerCase() : '',
  )
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  password: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }): string =>
    typeof value === 'string' ? value.trim() : '',
  )
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }): string =>
    typeof value === 'string' ? value.trim() : '',
  )
  lastName: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }: { value: unknown }): string | undefined =>
    typeof value === 'string' ? value.trim().toUpperCase() : undefined,
  )
  institutionalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }): string | undefined =>
    typeof value === 'string' ? value.trim() : undefined,
  )
  course?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }): string | undefined =>
    typeof value === 'string' ? value.trim() : undefined,
  )
  tutor?: string;
}
