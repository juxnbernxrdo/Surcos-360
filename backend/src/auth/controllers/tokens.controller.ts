import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TokensService } from '../services/tokens.service';
import { CreateTokenDto } from '../dto/create-token.dto';
import { VerifyTokenDto } from '../dto/verify-token.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Throttle } from '@nestjs/throttler';
import { UserType } from '@prisma/client';

interface UserContext {
  userId?: string;
  institutionalPerson?: {
    id: string;
    userType?: UserType;
  };
}

@Controller('auth/tokens')
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHORITY, UserType.TEACHER)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createToken(
    @Body() dto: CreateTokenDto,
    @CurrentUser() user: UserContext,
  ) {
    const actorId =
      user.institutionalPerson?.id || user.userId || 'system-admin';
    const { tokenRecord, plaintextToken } =
      await this.tokensService.createToken(dto, actorId);

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Registration token generated successfully',
      data: {
        id: tokenRecord.id,
        token: plaintextToken,
        type: tokenRecord.type,
        status: tokenRecord.status,
        maxUses: tokenRecord.maxUses,
        expiresAt: tokenRecord.expiresAt,
        metadata: tokenRecord.metadata,
      },
    };
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyToken(@Body() dto: VerifyTokenDto) {
    const tokenRecord = await this.tokensService.verifyToken(dto.token);
    return {
      statusCode: HttpStatus.OK,
      valid: true,
      type: tokenRecord.type,
      metadata: tokenRecord.metadata,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHORITY, UserType.TEACHER)
  @Get()
  async listTokens() {
    const tokens = await this.tokensService.listTokens();
    return {
      statusCode: HttpStatus.OK,
      data: tokens,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHORITY)
  @Patch(':id/revoke')
  async revokeToken(@Param('id') id: string, @CurrentUser() user: UserContext) {
    const actorId =
      user.institutionalPerson?.id || user.userId || 'system-admin';
    const revokedToken = await this.tokensService.revokeToken(id, actorId);
    return {
      statusCode: HttpStatus.OK,
      message: 'Token revoked successfully',
      data: revokedToken,
    };
  }
}
