import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

export class ReauthDto {
  @IsString()
  @IsNotEmpty({ message: 'Current password is required for reauthentication' })
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
