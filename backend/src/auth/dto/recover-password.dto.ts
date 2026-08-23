import { IsEmail, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class RecoverPasswordDto {
  @IsEmail({}, { message: 'A valid email address is required' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : '',
  )
  @MaxLength(255)
  email: string;
}
