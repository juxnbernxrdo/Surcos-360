import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterRepresentativeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  token: string;

  @IsEmail({}, { message: 'A valid email address is required' })
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
  @MaxLength(30)
  @Transform(({ value }: { value: unknown }): string | undefined =>
    typeof value === 'string' ? value.trim() : undefined,
  )
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }: { value: unknown }): string | undefined =>
    typeof value === 'string' ? value.trim() : undefined,
  )
  identificationNumber?: string;
}
