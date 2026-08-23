import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './controllers/auth.controller';
import { TokensController } from './controllers/tokens.controller';
import { AuthService } from './services/auth.service';
import { TokensService } from './services/tokens.service';
import { SupabaseAuthService } from './services/supabase-auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
import { OrgPermissionsGuard } from './guards/org-permissions.guard';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [AuthController, TokensController],
  providers: [
    AuthService,
    TokensService,
    SupabaseAuthService,
    JwtStrategy,
    RolesGuard,
    OrgPermissionsGuard,
  ],
  exports: [
    AuthService,
    TokensService,
    SupabaseAuthService,
    JwtStrategy,
    PassportModule,
  ],
})
export class AuthModule {}
