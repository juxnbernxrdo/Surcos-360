import { SetMetadata } from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';

export const ORG_PERMISSIONS_KEY = 'org_permissions';
export const ORG_ROLES_KEY = 'org_roles';

/**
 * Decorator to require specific modular permissions in an organization context.
 * e.g. @RequirePermissions('inventory.read', 'sales.create')
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(ORG_PERMISSIONS_KEY, permissions);

/**
 * Decorator to require specific organizational role levels.
 * e.g. @OrgRoles(OrganizationRole.ADMIN)
 */
export const OrgRoles = (...roles: OrganizationRole[]) =>
  SetMetadata(ORG_ROLES_KEY, roles);

export const OrgPermissions = (...items: string[]) =>
  SetMetadata(ORG_PERMISSIONS_KEY, items);
