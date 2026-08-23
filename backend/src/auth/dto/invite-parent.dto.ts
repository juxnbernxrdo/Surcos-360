import { IsOptional, IsString, MaxLength, IsEmail } from 'class-validator';
import { Transform } from 'class-transformer';

export class InviteParentDto {
  @IsOptional()
  @IsEmail({}, { message: 'A valid email address is required if provided' })
  @Transform(({ value }: { value: unknown }): string | undefined =>
    typeof value === 'string' ? value.trim().toLowerCase() : undefined,
  )
  @MaxLength(255)
  parentEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }): string | undefined =>
    typeof value === 'string' ? value.trim() : undefined,
  )
  parentName?: string;
}
