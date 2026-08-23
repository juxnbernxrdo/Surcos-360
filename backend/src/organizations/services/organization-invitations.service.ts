import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrganizationInvitationDto } from '../dto/create-organization-invitation.dto';
import {
  OrganizationRole,
  OrganizationStatus,
  TokenStatus,
} from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class OrganizationInvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates SHA-256 cryptographic hash of a raw token string.
   */
  hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Generates a CSPRNG-backed secure token string for invitations.
   */
  generateSecureToken(prefix = 'org_inv'): string {
    const randomHex = crypto.randomBytes(32).toString('hex');
    return `${prefix}_${randomHex}`;
  }

  /**
   * Creates a secure, one-time invitation for a user to join an organization.
   * Only the SHA-256 hash is persisted in the database.
   */
  async createInvitation(
    organizationId: string,
    dto: CreateOrganizationInvitationDto,
    actorId: string,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new NotFoundException('Organización no encontrada.');
    }

    if (org.status !== OrganizationStatus.ACTIVE) {
      throw new ForbiddenException(
        'No se pueden emitir invitaciones para una organización inactiva o suspendida.',
      );
    }

    const normalizedEmail = dto.email.toLowerCase().trim();

    // Check if user is already an active member of this organization
    const existingPerson = await this.prisma.institutionalPerson.findUnique({
      where: { email: normalizedEmail },
      include: {
        memberships: {
          where: { organizationId },
        },
      },
    });

    if (existingPerson && existingPerson.memberships.length > 0) {
      const activeMembership = existingPerson.memberships.find(
        (m) => m.status === 'ACTIVE',
      );
      if (activeMembership) {
        throw new ConflictException(
          `El usuario con correo '${normalizedEmail}' ya es miembro activo de esta organización.`,
        );
      }
    }

    // Exact single ADMIN enforcement: check if inviting as ADMIN when one already exists
    if (dto.role === OrganizationRole.ADMIN) {
      const existingAdmin = await this.prisma.membership.findFirst({
        where: {
          organizationId,
          role: OrganizationRole.ADMIN,
          status: 'ACTIVE',
        },
      });

      if (existingAdmin) {
        throw new BadRequestException(
          'La organización ya cuenta con un Administrador (ADMIN) activo. Solo se permite un ADMIN por organización.',
        );
      }
    }

    // Revoke any previous active invitation for this email in this org
    await this.prisma.organizationInvitation.updateMany({
      where: {
        organizationId,
        email: normalizedEmail,
        status: TokenStatus.ACTIVE,
      },
      data: { status: TokenStatus.REVOKED },
    });

    const plaintextToken = this.generateSecureToken();
    const tokenHash = this.hashToken(plaintextToken);

    const expiresInDays = dto.expiresInDays || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const invitation = await this.prisma.organizationInvitation.create({
      data: {
        organizationId,
        email: normalizedEmail,
        role: dto.role || OrganizationRole.USER,
        permissions: dto.permissions || [],
        tokenHash,
        status: TokenStatus.ACTIVE,
        maxUses: 1,
        usesCount: 0,
        expiresAt,
        invitedBy: actorId,
      },
      include: {
        organization: {
          select: { id: true, name: true, code: true },
        },
        inviter: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        organizationId,
        action: 'ORGANIZATION_INVITATION_CREATED',
        entity: 'OrganizationInvitation',
        entityId: invitation.id,
        newState: {
          email: normalizedEmail,
          role: invitation.role,
          permissions: invitation.permissions,
          expiresAt: invitation.expiresAt,
        },
      },
    });

    return {
      invitation: {
        id: invitation.id,
        organizationId: invitation.organizationId,
        organizationName: invitation.organization.name,
        organizationCode: invitation.organization.code,
        email: invitation.email,
        role: invitation.role,
        permissions: invitation.permissions,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        inviter: invitation.inviter,
      },
      plaintextToken,
    };
  }

  /**
   * Verifies an invitation token without consuming it.
   */
  async verifyInvitation(rawToken: string) {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new BadRequestException('Token de invitación no provisto.');
    }

    const tokenHash = this.hashToken(rawToken.trim());
    const invitation = await this.prisma.organizationInvitation.findUnique({
      where: { tokenHash },
      include: {
        organization: {
          select: { id: true, name: true, code: true, status: true },
        },
        inviter: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!invitation) {
      throw new BadRequestException(
        'Token de invitación inválido o no encontrado.',
      );
    }

    if (invitation.status !== TokenStatus.ACTIVE) {
      throw new BadRequestException(
        `La invitación ya no está activa (Estado: ${invitation.status}).`,
      );
    }

    if (new Date() > invitation.expiresAt) {
      await this.prisma.organizationInvitation.update({
        where: { id: invitation.id },
        data: { status: TokenStatus.EXPIRED },
      });
      throw new BadRequestException('La invitación ha expirado.');
    }

    if (invitation.usesCount >= invitation.maxUses) {
      throw new BadRequestException(
        'La invitación ya ha alcanzado su límite de usos.',
      );
    }

    if (invitation.organization.status !== OrganizationStatus.ACTIVE) {
      throw new ForbiddenException(
        'La organización vinculada a esta invitación se encuentra inactiva o suspendida.',
      );
    }

    return {
      id: invitation.id,
      organizationId: invitation.organizationId,
      organizationName: invitation.organization.name,
      organizationCode: invitation.organization.code,
      email: invitation.email,
      role: invitation.role,
      permissions: invitation.permissions,
      expiresAt: invitation.expiresAt,
      inviterName: `${invitation.inviter.firstName} ${invitation.inviter.lastName}`,
    };
  }

  /**
   * Lists all invitations for a specific organization.
   */
  async listInvitations(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new NotFoundException('Organización no encontrada.');
    }

    return this.prisma.organizationInvitation.findMany({
      where: { organizationId },
      include: {
        inviter: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Revokes an active invitation.
   */
  async revokeInvitation(
    organizationId: string,
    invitationId: string,
    actorId: string,
  ) {
    const invitation = await this.prisma.organizationInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.organizationId !== organizationId) {
      throw new NotFoundException(
        'Invitación no encontrada en esta organización.',
      );
    }

    if (invitation.status !== TokenStatus.ACTIVE) {
      throw new BadRequestException(
        `Solo se pueden revocar invitaciones activas (Estado actual: ${invitation.status}).`,
      );
    }

    const updated = await this.prisma.organizationInvitation.update({
      where: { id: invitationId },
      data: { status: TokenStatus.REVOKED },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        organizationId,
        action: 'ORGANIZATION_INVITATION_REVOKED',
        entity: 'OrganizationInvitation',
        entityId: invitationId,
        previousState: { status: invitation.status },
        newState: { status: TokenStatus.REVOKED },
      },
    });

    return {
      message: 'Invitación revocada exitosamente.',
      invitation: updated,
    };
  }
}
