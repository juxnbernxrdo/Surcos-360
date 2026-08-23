import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { RegisterRepresentativeDto } from '../dto/register-representative.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RecoverPasswordDto } from '../dto/recover-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ReauthDto } from '../dto/reauth.dto';
import { InviteParentDto } from '../dto/invite-parent.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Throttle } from '@nestjs/throttler';

interface ExpressReq {
  ip?: string;
  headers?: Record<string, string | undefined>;
}

interface UserCtx {
  userId?: string;
  id?: string;
  institutionalPerson?: {
    id: string;
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto, @Req() req: ExpressReq) {
    const ipAddress = req.ip || (req.headers && req.headers['x-forwarded-for']);
    const userAgent = req.headers && req.headers['user-agent'];
    const user = await this.authService.register(dto, ipAddress, userAgent);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Registro institucional exitoso',
      data: { user },
    };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register-representative')
  @HttpCode(HttpStatus.CREATED)
  async registerRepresentative(
    @Body() dto: RegisterRepresentativeDto,
    @Req() req: ExpressReq,
  ) {
    const ipAddress = req.ip || (req.headers && req.headers['x-forwarded-for']);
    const userAgent = req.headers && req.headers['user-agent'];
    const user = await this.authService.registerRepresentative(
      dto,
      ipAddress,
      userAgent,
    );
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Representante legal registrado y vinculado exitosamente',
      data: { user },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('invite-parent')
  @HttpCode(HttpStatus.CREATED)
  async inviteParent(
    @CurrentUser() user: UserCtx,
    @Body() dto?: InviteParentDto,
  ) {
    const studentId =
      user.institutionalPerson?.id || user.id || user.userId || '';
    const result = await this.authService.generateParentInvitation(
      studentId,
      dto,
    );
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Enlace de invitación generado exitosamente',
      data: result,
    };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: ExpressReq) {
    const ipAddress = req.ip || (req.headers && req.headers['x-forwarded-for']);
    const userAgent = req.headers && req.headers['user-agent'];
    const result = await this.authService.login(dto, ipAddress, userAgent);
    return {
      statusCode: HttpStatus.OK,
      message: 'Login exitoso',
      data: result,
    };
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: ExpressReq) {
    const ipAddress = req.ip || (req.headers && req.headers['x-forwarded-for']);
    const userAgent = req.headers && req.headers['user-agent'];
    const result = await this.authService.refreshToken(
      dto.refreshToken,
      ipAddress,
      userAgent,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Sesión renovada exitosamente',
      data: result,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: UserCtx) {
    const profile = await this.authService.getProfile(
      user.userId || user.institutionalPerson?.id || user.id || '',
    );
    return {
      statusCode: HttpStatus.OK,
      data: profile,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: ExpressReq, @CurrentUser() user: UserCtx) {
    const authHeader = req.headers ? req.headers.authorization : undefined;
    const jwtToken = authHeader ? authHeader.split(' ')[1] : '';
    const actorId =
      user.institutionalPerson?.id || user.userId || user.id || '';
    const ipAddress = req.ip || (req.headers && req.headers['x-forwarded-for']);
    const userAgent = req.headers && req.headers['user-agent'];

    await this.authService.logout(jwtToken, actorId, ipAddress, userAgent);
    return {
      statusCode: HttpStatus.OK,
      message: 'Cierre de sesión exitoso',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(@Req() req: ExpressReq, @CurrentUser() user: UserCtx) {
    const userId = user.userId || user.id || '';
    const actorId =
      user.institutionalPerson?.id || user.userId || user.id || '';
    const ipAddress = req.ip || (req.headers && req.headers['x-forwarded-for']);
    const userAgent = req.headers && req.headers['user-agent'];

    await this.authService.logoutAll(userId, actorId, ipAddress, userAgent);
    return {
      statusCode: HttpStatus.OK,
      message: 'Todas las sesiones activas han sido cerradas.',
    };
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('recover-password')
  @HttpCode(HttpStatus.OK)
  async recoverPassword(
    @Body() dto: RecoverPasswordDto,
    @Req() req: ExpressReq,
  ) {
    const ipAddress = req.ip || (req.headers && req.headers['x-forwarded-for']);
    const userAgent = req.headers && req.headers['user-agent'];
    const result = await this.authService.recoverPassword(
      dto.email,
      ipAddress,
      userAgent,
    );
    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: ExpressReq) {
    const ipAddress = req.ip || (req.headers && req.headers['x-forwarded-for']);
    const userAgent = req.headers && req.headers['user-agent'];
    const result = await this.authService.resetPassword(
      dto,
      ipAddress,
      userAgent,
    );
    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: UserCtx,
    @Body() dto: ChangePasswordDto,
    @Req() req: ExpressReq,
  ) {
    const userId = user.userId || user.id || '';
    const ipAddress = req.ip || (req.headers && req.headers['x-forwarded-for']);
    const userAgent = req.headers && req.headers['user-agent'];

    const result = await this.authService.changePassword(
      userId,
      dto,
      ipAddress,
      userAgent,
    );
    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reauthenticate')
  @HttpCode(HttpStatus.OK)
  async reauthenticate(
    @CurrentUser() user: UserCtx,
    @Body() dto: ReauthDto,
    @Req() req: ExpressReq,
  ) {
    const userId = user.userId || user.id || '';
    const ipAddress = req.ip || (req.headers && req.headers['x-forwarded-for']);
    const userAgent = req.headers && req.headers['user-agent'];

    const result = await this.authService.reauthenticate(
      userId,
      dto.password,
      ipAddress,
      userAgent,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Reautenticación exitosa',
      data: result,
    };
  }
}
