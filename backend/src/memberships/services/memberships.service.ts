import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationInvitationsService } from '../../organizations/services/organization-invitations.service';
import {
  UpdateMembershipPermissionsDto,
  UpdateMembershipStatusDto,
  ClaimInvitationDto,
  RegisterWithInvitationDto,
  QueryMembershipsDto,
} from '../dto';
import { AddDirectMemberDto } from '../../organizations/dto/add-direct-member.dto';
import {
  OrganizationRole,
  OrganizationStatus,
  MembershipStatus,
  InstitutionStatus,
  TokenStatus,
  UserType,
  Prisma,
} from '@prisma/client';

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invitationsService: OrganizationInvitationsService,
  ) {}

  /**
   * Directly adds an existing institutional person as a member to an organization (§6, §8 PRD v1.0).
   * Enforces: Exactly ONE ADMIN per PYME.
   */
  async addDirectMember(
    organizationId: string,
    dto: AddDirectMemberDto,
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
        'No se pueden añadir miembros a una organización inactiva o suspendida.',
      );
    }

    const person = await this.prisma.institutionalPerson.findUnique({
      where: { id: dto.institutionalPersonId },
    });
    if (!person) {
      throw new NotFoundException('Persona institucional no encontrada.');
    }
    if (person.status !== InstitutionStatus.ACTIVE) {
      throw new ForbiddenException(
        'La persona institucional se encuentra inactiva o suspendida.',
      );
    }

    const existingMembership = await this.prisma.membership.findUnique({
      where: {
        institutionalPersonId_organizationId: {
          institutionalPersonId: dto.institutionalPersonId,
          organizationId,
        },
      },
    });

    if (existingMembership) {
      if (existingMembership.status === MembershipStatus.ACTIVE) {
        throw new ConflictException(
          'La persona ya es miembro activo de esta organización.',
        );
      }
    }

    // Exact single ADMIN check
    const requestedRole = dto.role || OrganizationRole.USER;
    if (requestedRole === OrganizationRole.ADMIN) {
      const existingAdmin = await this.prisma.membership.findFirst({
        where: {
          organizationId,
          role: OrganizationRole.ADMIN,
          status: MembershipStatus.ACTIVE,
        },
      });

      if (existingAdmin) {
        throw new BadRequestException(
          'La organización ya cuenta con un Administrador (ADMIN) activo. Solo se permite un ADMIN por organización.',
        );
      }
    }

    const membership = existingMembership
      ? await this.prisma.membership.update({
          where: { id: existingMembership.id },
          data: {
            role: requestedRole,
            permissions:
              requestedRole === OrganizationRole.ADMIN
                ? []
                : dto.permissions || [],
            status: MembershipStatus.ACTIVE,
            joinedAt: new Date(),
            leftAt: null,
            notes: dto.notes ? dto.notes.trim() : null,
            invitedById: actorId,
          },
          include: {
            organization: true,
            institutionalPerson: true,
          },
        })
      : await this.prisma.membership.create({
          data: {
            organizationId,
            institutionalPersonId: dto.institutionalPersonId,
            role: requestedRole,
            permissions:
              requestedRole === OrganizationRole.ADMIN
                ? []
                : dto.permissions || [],
            status: MembershipStatus.ACTIVE,
            joinedAt: new Date(),
            notes: dto.notes ? dto.notes.trim() : null,
            invitedById: actorId,
          },
          include: {
            organization: true,
            institutionalPerson: true,
          },
        });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        organizationId,
        action: 'MEMBERSHIP_CREATED',
        entity: 'Membership',
        entityId: membership.id,
        newState: {
          institutionalPersonId: dto.institutionalPersonId,
          role: membership.role,
          permissions: membership.permissions,
          status: membership.status,
        },
      },
    });

    return membership;
  }

  /**
   * Claims an invitation for an existing authenticated user (§9, §10 PRD v1.0).
   */
  async claimInvitation(
    dto: ClaimInvitationDto,
    actorInstitutionalPersonId: string,
  ) {
    const rawToken = dto.token.trim();
    const tokenHash = this.invitationsService.hashToken(rawToken);

    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.organizationInvitation.findUnique({
        where: { tokenHash },
        include: {
          organization: true,
        },
      });

      if (!invitation) {
        throw new BadRequestException(
          'Token de invitación inválido o no encontrado.',
        );
      }

      if (invitation.status !== TokenStatus.ACTIVE) {
        throw new BadRequestException(
          `La invitación ya no se encuentra activa (Estado: ${invitation.status}).`,
        );
      }

      if (new Date() > invitation.expiresAt) {
        await tx.organizationInvitation.update({
          where: { id: invitation.id },
          data: { status: TokenStatus.EXPIRED },
        });
        throw new BadRequestException('La invitación ha expirado.');
      }

      if (invitation.usesCount >= invitation.maxUses) {
        throw new BadRequestException(
          'La invitación ya ha alcanzado el límite máximo de usos.',
        );
      }

      if (invitation.organization.status !== OrganizationStatus.ACTIVE) {
        throw new ForbiddenException(
          'La organización vinculada a la invitación se encuentra inactiva o suspendida.',
        );
      }

      const person = await tx.institutionalPerson.findUnique({
        where: { id: actorInstitutionalPersonId },
      });

      if (!person || person.status !== InstitutionStatus.ACTIVE) {
        throw new ForbiddenException(
          'Su cuenta institucional no está activa para reclamar esta membresía.',
        );
      }

      // Check if existing membership exists
      const existingMembership = await tx.membership.findUnique({
        where: {
          institutionalPersonId_organizationId: {
            institutionalPersonId: actorInstitutionalPersonId,
            organizationId: invitation.organizationId,
          },
        },
      });

      if (
        existingMembership &&
        existingMembership.status === MembershipStatus.ACTIVE
      ) {
        throw new ConflictException(
          'Usted ya es miembro activo de esta organización.',
        );
      }

      // Enforce Single ADMIN rule if invitation role is ADMIN
      if (invitation.role === OrganizationRole.ADMIN) {
        const existingAdmin = await tx.membership.findFirst({
          where: {
            organizationId: invitation.organizationId,
            role: OrganizationRole.ADMIN,
            status: MembershipStatus.ACTIVE,
          },
        });

        if (existingAdmin) {
          throw new BadRequestException(
            'La organización ya posee un Administrador (ADMIN) activo.',
          );
        }
      }

      // Create or activate membership
      const membership = existingMembership
        ? await tx.membership.update({
            where: { id: existingMembership.id },
            data: {
              role: invitation.role,
              permissions:
                invitation.role === OrganizationRole.ADMIN
                  ? []
                  : invitation.permissions,
              status: MembershipStatus.ACTIVE,
              joinedAt: new Date(),
              leftAt: null,
              invitedById: invitation.invitedBy,
            },
            include: {
              organization: true,
              institutionalPerson: true,
            },
          })
        : await tx.membership.create({
            data: {
              organizationId: invitation.organizationId,
              institutionalPersonId: actorInstitutionalPersonId,
              role: invitation.role,
              permissions:
                invitation.role === OrganizationRole.ADMIN
                  ? []
                  : invitation.permissions,
              status: MembershipStatus.ACTIVE,
              joinedAt: new Date(),
              invitedById: invitation.invitedBy,
            },
            include: {
              organization: true,
              institutionalPerson: true,
            },
          });

      // Mark invitation as USED
      await tx.organizationInvitation.update({
        where: { id: invitation.id },
        data: {
          status: TokenStatus.USED,
          usesCount: invitation.usesCount + 1,
        },
      });

      // Create audit logs
      await tx.auditLog.create({
        data: {
          actorId: actorInstitutionalPersonId,
          organizationId: invitation.organizationId,
          action: 'ORGANIZATION_INVITATION_ACCEPTED',
          entity: 'OrganizationInvitation',
          entityId: invitation.id,
          newState: {
            membershipId: membership.id,
            status: TokenStatus.USED,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actorInstitutionalPersonId,
          organizationId: invitation.organizationId,
          action: 'MEMBERSHIP_CREATED',
          entity: 'Membership',
          entityId: membership.id,
          newState: {
            role: membership.role,
            permissions: membership.permissions,
            status: membership.status,
          },
        },
      });

      return {
        message: 'Invitación aceptada exitosamente. Membresía creada.',
        membership,
      };
    });
  }

  /**
   * Registers a new institutional user with an invitation token and creates membership atomically (§11 PRD v1.0).
   */
  async registerWithInvitation(dto: RegisterWithInvitationDto) {
    const rawToken = dto.token.trim();
    const tokenHash = this.invitationsService.hashToken(rawToken);
    const normalizedEmail = dto.email.toLowerCase().trim();

    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.organizationInvitation.findUnique({
        where: { tokenHash },
        include: {
          organization: true,
        },
      });

      if (!invitation) {
        throw new BadRequestException(
          'Token de invitación inválido o no encontrado.',
        );
      }

      if (invitation.status !== TokenStatus.ACTIVE) {
        throw new BadRequestException(
          `La invitación ya no se encuentra activa (Estado: ${invitation.status}).`,
        );
      }

      if (new Date() > invitation.expiresAt) {
        await tx.organizationInvitation.update({
          where: { id: invitation.id },
          data: { status: TokenStatus.EXPIRED },
        });
        throw new BadRequestException('La invitación ha expirado.');
      }

      if (invitation.usesCount >= invitation.maxUses) {
        throw new BadRequestException(
          'La invitación ya ha alcanzado el límite de usos.',
        );
      }

      if (invitation.organization.status !== OrganizationStatus.ACTIVE) {
        throw new ForbiddenException(
          'La organización vinculada a esta invitación se encuentra inactiva o suspendida.',
        );
      }

      // Check email matching
      if (invitation.email.toLowerCase() !== normalizedEmail) {
        throw new BadRequestException(
          `El correo provisto ('${normalizedEmail}') no coincide con el destinatario de la invitación ('${invitation.email}').`,
        );
      }

      // Check if InstitutionalPerson already exists
      let person = await tx.institutionalPerson.findUnique({
        where: { email: normalizedEmail },
      });

      if (!person) {
        const institutionalCode =
          dto.institutionalCode ||
          `USR-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

        person = await tx.institutionalPerson.create({
          data: {
            email: normalizedEmail,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            institutionalCode,
            userType: UserType.TEACHER, // Default general institutional identity for invited staff
            status: InstitutionStatus.ACTIVE,
          },
        });
      }

      // Check Single ADMIN rule
      if (invitation.role === OrganizationRole.ADMIN) {
        const existingAdmin = await tx.membership.findFirst({
          where: {
            organizationId: invitation.organizationId,
            role: OrganizationRole.ADMIN,
            status: MembershipStatus.ACTIVE,
          },
        });

        if (existingAdmin) {
          throw new BadRequestException(
            'La organización ya posee un Administrador (ADMIN) activo.',
          );
        }
      }

      // Create membership
      const membership = await tx.membership.create({
        data: {
          organizationId: invitation.organizationId,
          institutionalPersonId: person.id,
          role: invitation.role,
          permissions:
            invitation.role === OrganizationRole.ADMIN
              ? []
              : invitation.permissions,
          status: MembershipStatus.ACTIVE,
          joinedAt: new Date(),
          invitedById: invitation.invitedBy,
        },
        include: {
          organization: true,
          institutionalPerson: true,
        },
      });

      // Mark invitation USED
      await tx.organizationInvitation.update({
        where: { id: invitation.id },
        data: {
          status: TokenStatus.USED,
          usesCount: invitation.usesCount + 1,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: person.id,
          organizationId: invitation.organizationId,
          action: 'ORGANIZATION_INVITATION_ACCEPTED',
          entity: 'OrganizationInvitation',
          entityId: invitation.id,
          newState: {
            membershipId: membership.id,
            personId: person.id,
          },
        },
      });

      return {
        message: 'Usuario registrado y membresía creada exitosamente.',
        person,
        membership,
      };
    });
  }

  /**
   * Updates granular modular permissions of an existing member (§5.2 PRD v1.0).
   */
  async updatePermissions(
    membershipId: string,
    dto: UpdateMembershipPermissionsDto,
    actorId: string,
  ) {
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
    });

    if (!membership) {
      throw new NotFoundException('Membresía no encontrada.');
    }

    if (membership.status !== MembershipStatus.ACTIVE) {
      throw new BadRequestException(
        `No se pueden modificar los permisos de una membresía con estado '${membership.status}'. Debe estar ACTIVE.`,
      );
    }

    const updated = await this.prisma.membership.update({
      where: { id: membershipId },
      data: {
        permissions: dto.permissions,
      },
      include: {
        institutionalPerson: true,
        organization: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        organizationId: membership.organizationId,
        action: 'MEMBERSHIP_PERMISSIONS_CHANGED',
        entity: 'Membership',
        entityId: membershipId,
        previousState: { permissions: membership.permissions },
        newState: { permissions: updated.permissions },
      },
    });

    return updated;
  }

  /**
   * Updates the lifecycle status of a membership (ACTIVE, SUSPENDED, REVOKED) (§17 PRD v1.0).
   * Enforces: Sole ADMIN cannot be suspended or revoked without transferring admin leadership.
   */
  async updateStatus(
    membershipId: string,
    dto: UpdateMembershipStatusDto,
    actorId: string,
  ) {
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
    });

    if (!membership) {
      throw new NotFoundException('Membresía no encontrada.');
    }

    // Protection against disabling the sole active ADMIN (§19 PRD v1.0)
    if (
      membership.role === OrganizationRole.ADMIN &&
      (dto.status === MembershipStatus.SUSPENDED ||
        dto.status === MembershipStatus.REVOKED)
    ) {
      throw new BadRequestException(
        'No se puede suspender ni revocar al Administrador (ADMIN) de la organización. Transfiera primero la administración a otro miembro activo.',
      );
    }

    const isRevoked = dto.status === MembershipStatus.REVOKED;
    const isActive = dto.status === MembershipStatus.ACTIVE;

    const updated = await this.prisma.membership.update({
      where: { id: membershipId },
      data: {
        status: dto.status,
        leftAt: isRevoked ? new Date() : isActive ? null : membership.leftAt,
      },
      include: {
        institutionalPerson: true,
        organization: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        organizationId: membership.organizationId,
        action: 'MEMBERSHIP_STATUS_CHANGED',
        entity: 'Membership',
        entityId: membershipId,
        previousState: { status: membership.status },
        newState: { status: updated.status, reason: dto.reason },
      },
    });

    return updated;
  }

  /**
   * Removes / revokes a membership.
   * Enforces: Sole ADMIN cannot be deleted. Institutional Person and User are preserved (§18, §19 PRD v1.0).
   */
  async removeMember(membershipId: string, actorId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
    });

    if (!membership) {
      throw new NotFoundException('Membresía no encontrada.');
    }

    if (membership.role === OrganizationRole.ADMIN) {
      throw new BadRequestException(
        'No se puede eliminar la membresía del Administrador (ADMIN). Transfiera primero la administración a otro miembro.',
      );
    }

    await this.prisma.membership.delete({
      where: { id: membershipId },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        organizationId: membership.organizationId,
        action: 'MEMBERSHIP_REMOVED',
        entity: 'Membership',
        entityId: membershipId,
        previousState: {
          institutionalPersonId: membership.institutionalPersonId,
          role: membership.role,
          permissions: membership.permissions,
        },
      },
    });

    return {
      message:
        'Membresía eliminada exitosamente. La cuenta del usuario permanece intacta en Surcos 360.',
    };
  }

  /**
   * Retrieves single membership by ID.
   */
  async findById(membershipId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
      include: {
        organization: true,
        institutionalPerson: {
          include: {
            studentProfile: true,
            teacherProfile: true,
            authorityProfile: true,
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Membresía no encontrada.');
    }

    return membership;
  }

  /**
   * Lists memberships for a specific user.
   */
  async findUserMemberships(institutionalPersonId: string) {
    return this.prisma.membership.findMany({
      where: { institutionalPersonId },
      include: {
        organization: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Queries memberships with filters and pagination.
   */
  async findAll(query: QueryMembershipsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.MembershipWhereInput = {};

    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }

    if (query.institutionalPersonId) {
      where.institutionalPersonId = query.institutionalPersonId;
    }

    if (query.role) {
      where.role = query.role;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.institutionalPerson = {
        OR: [
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    const [total, memberships] = await Promise.all([
      this.prisma.membership.count({ where }),
      this.prisma.membership.findMany({
        where,
        include: {
          organization: true,
          institutionalPerson: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: memberships,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
