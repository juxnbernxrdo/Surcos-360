import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class VerifyTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  token: string;
}
