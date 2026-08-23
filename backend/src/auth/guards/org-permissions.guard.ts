import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  OrganizationRole,
  UserType,
  InstitutionStatus,
  MembershipStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ORG_PERMISSIONS_KEY,
  ORG_ROLES_KEY,
} from '../decorators/org-permissions.decorator';

interface MembershipItem {
  id?: string;
  organizationId: string;
  role: OrganizationRole;
  permissions?: string[];
  status?: MembershipStatus;
}

interface RequestUser {
  id?: string;
  userId?: string;
  institutionalPerson?: {
    id: string;
    userType?: UserType;
    status?: InstitutionStatus;
  };
  memberships?: MembershipItem[];
}

@Injectable()
export class OrgPermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(ORG_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    const requiredRoles =
      this.reflector.getAllAndOverride<OrganizationRole[]>(ORG_ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    // If neither permissions nor roles are specified, allow through
    if (requiredPermissions.length === 0 && requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: RequestUser;
      baseUrl?: string;
      url?: string;
      headers: Record<string, string | undefined>;
      params: Record<string, string | undefined>;
      query: Record<string, string | undefined>;
      body: Record<string, string | undefined>;
    }>();

    const user = request.user;
    const person = user?.institutionalPerson;

    if (!user || !person) {
      throw new UnauthorizedException(
        'Información de autenticación de usuario no encontrada',
      );
    }

    if (person.status && person.status !== InstitutionStatus.ACTIVE) {
      throw new ForbiddenException(
        'La cuenta institucional se encuentra inactiva o suspendida',
      );
    }

    // Global institutional directiva (Authority) has platform-wide supervisory scope (§5.1 PRD v1.0)
    if (person.userType === UserType.AUTHORITY) {
      return true;
    }

    const url = request.baseUrl || request.url || '';
    const isOrgEndpoint = url.includes('/organizations');
    const isMembershipEndpoint = url.includes('/memberships');

    let organizationId =
      request.headers['x-organization-id'] ||
      request.params.orgId ||
      request.params.organizationId ||
      (isOrgEndpoint ? request.params.id : undefined) ||
      request.query?.organizationId ||
      request.body?.organizationId;

    // If route is /memberships/:id/... and no org ID was directly in params/headers, resolve via membership record
    if (!organizationId && isMembershipEndpoint && request.params.id) {
      const targetMembership = await this.prisma.membership.findUnique({
        where: { id: request.params.id },
        select: { organizationId: true },
      });
      if (targetMembership) {
        organizationId = targetMembership.organizationId;
      }
    }

    if (!organizationId) {
      throw new ForbiddenException(
        'El identificador de la organización objetivo (Tenant Context) es obligatorio',
      );
    }

    // If organizationId is passed as code (e.g. 'AGRORED'), resolve to uuid
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        organizationId,
      );

    let resolvedOrgId = organizationId;
    if (!isUuid) {
      const org = await this.prisma.organization.findUnique({
        where: { code: organizationId.toUpperCase() },
        select: { id: true, status: true },
      });
      if (org) {
        resolvedOrgId = org.id;
      }
    }

    // Resolve active membership from user context or DB
    let activeMembership: MembershipItem | null | undefined =
      user.memberships?.find(
        (m: MembershipItem) =>
          (m.organizationId === resolvedOrgId ||
            m.organizationId === organizationId) &&
          (m.status === undefined || m.status === MembershipStatus.ACTIVE),
      );

    if (!activeMembership && this.prisma?.membership?.findFirst) {
      activeMembership = await this.prisma.membership.findFirst({
        where: {
          institutionalPersonId: person.id,
          organizationId: resolvedOrgId,
          status: MembershipStatus.ACTIVE,
        },
      });
    }

    if (!activeMembership) {
      throw new ForbiddenException(
        'Access denied: El usuario no posee una membresía activa en esta organización',
      );
    }

    // Single active ADMIN has full organizational domain authority over this PYME (§4.3 PRD v1.0)
    if (activeMembership.role === OrganizationRole.ADMIN) {
      return true;
    }

    // If specific roles are required (e.g. @OrgRoles(ADMIN))
    if (requiredRoles.length > 0) {
      const hasRequiredRole = requiredRoles.includes(activeMembership.role);
      if (!hasRequiredRole) {
        throw new ForbiddenException(
          'Rol organizativo insuficiente para ejecutar esta operación',
        );
      }
    }

    // Check granular module permissions
    if (requiredPermissions.length > 0) {
      const userPerms = new Set(activeMembership.permissions || []);

      // If item in requiredPermissions is an OrganizationRole enum
      const roleMatches = requiredPermissions.some(
        (req) =>
          req === activeMembership.role || req === OrganizationRole.ADMIN,
      );
      if (roleMatches) {
        return true;
      }

      // Check string permissions e.g. "inventory.read", "members.manage"
      const permissionMatches = requiredPermissions.some(
        (req) => typeof req === 'string' && userPerms.has(req),
      );

      if (!permissionMatches) {
        throw new ForbiddenException(
          'Permisos insuficientes para realizar esta acción en la organización',
        );
      }
    }

    return true;
  }
}
