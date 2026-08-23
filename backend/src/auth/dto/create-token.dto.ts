import { IsEnum, IsInt, IsOptional, IsObject, Max, Min } from 'class-validator';
import { TokenType } from '@prisma/client';

export class CreateTokenDto {
  @IsEnum(TokenType)
  type: TokenType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxUses?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number = 7;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> = {};
}
