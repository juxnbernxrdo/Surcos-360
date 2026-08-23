import { IsOptional, IsString, IsEmail, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class InviteRepresentativeDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  parentEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  parentName?: string;
}
