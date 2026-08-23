import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = Record<string, unknown>>(
    err: unknown,
    user: TUser,
  ): TUser {
    if (err || !user) {
      if (err instanceof Error) {
        throw err;
      }
      throw new UnauthorizedException(
        'Authentication token is missing or invalid',
      );
    }
    return user;
  }
}
