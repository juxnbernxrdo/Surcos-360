import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserType, InstitutionStatus } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

interface RequestUser {
  institutionalPerson?: {
    id: string;
    userType?: UserType;
    status?: InstitutionStatus;
    studentRecord?: unknown;
  };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserType[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const person = request.user?.institutionalPerson;

    if (!person) {
      throw new ForbiddenException('User identity not found');
    }

    if (person.status && person.status !== InstitutionStatus.ACTIVE) {
      throw new ForbiddenException('Account is inactive or suspended');
    }

    // Check if user has one of the required roles or is AUTHORITY (global superuser)
    const hasRole =
      requiredRoles.includes(person.userType as UserType) ||
      person.userType === UserType.AUTHORITY;

    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions for this action');
    }

    return true;
  }
}
