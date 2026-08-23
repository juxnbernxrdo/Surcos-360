import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  refreshToken: string;
}
