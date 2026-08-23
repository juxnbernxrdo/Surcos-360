import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../../ledger/ledger.service';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  UpdateOrganizationStatusDto,
  QueryOrganizationsDto,
  TransferAdminDto,
} from '../dto';
import {
  OrganizationRole,
  OrganizationStatus,
  MembershipStatus,
  Prisma,
} from '@prisma/client';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  /**
   * Creates a new organization or PYME (§4 PRD v1.0).
   * Restricted to Authority role.
   */
  async createOrganization(dto: CreateOrganizationDto, actorId: string) {
    const code = dto.code.toUpperCase().trim();
    const existing = await this.prisma.organization.findUnique({
      where: { code },
    });

    if (existing) {
      throw new ConflictException(
        `Organización con código '${dto.code}' ya existe.`,
      );
    }

    const org = await this.prisma.organization.create({
      data: {
        name: dto.name.trim(),
        code,
        description: dto.description ? dto.description.trim() : null,
        isPyme: dto.isPyme ?? true,
        status: OrganizationStatus.ACTIVE,
        settings: (dto.settings || {}) as Prisma.InputJsonValue,
      },
    });

    // Automatically provision standard chart of accounts for the new organization
    await this.ledgerService.ensureOrganizationAccounts(
      org.id,
      org.code,
      org.name,
    );

    await this.prisma.auditLog.create({
      data: {
        actorId,
        organizationId: org.id,
        action: 'ORGANIZATION_CREATED',
        entity: 'Organization',
        entityId: org.id,
        newState: {
          name: org.name,
          code: org.code,
          isPyme: org.isPyme,
          status: org.status,
        },
      },
    });

    return org;
  }

  /**
   * Lists all organizations with filters, search, and pagination.
   */
  async findAll(query: QueryOrganizationsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.OrganizationWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.isPyme !== undefined) {
      where.isPyme = query.isPyme;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, organizations] = await Promise.all([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        include: {
          _count: {
            select: {
              memberships: true,
              products: true,
              sales: true,
              assets: true,
              liabilities: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      data: organizations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves single organization with complete operational details and ledger accounts.
   */
  async findById(idOrCode: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idOrCode,
      );

    const org = await this.prisma.organization.findFirst({
      where: isUuid
        ? { OR: [{ id: idOrCode }, { code: idOrCode.toUpperCase() }] }
        : { code: idOrCode.toUpperCase() },
      include: {
        ledgerAccounts: true,
        _count: {
          select: {
            memberships: true,
            products: true,
            sales: true,
            purchases: true,
            assets: true,
            liabilities: true,
            expenses: true,
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException(
        `Organización '${idOrCode}' no fue encontrada.`,
      );
    }

    return org;
  }

  /**
   * Retrieves all organizations associated with a specific user's memberships.
   */
  async findUserOrganizations(institutionalPersonId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: {
        institutionalPersonId,
        status: MembershipStatus.ACTIVE,
      },
      include: {
        organization: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return memberships.map((m) => ({
      membershipId: m.id,
      role: m.role,
      permissions: m.permissions,
      status: m.status,
      joinedAt: m.joinedAt,
      organization: m.organization,
    }));
  }

  /**
   * Updates an existing organization's metadata or configuration.
   */
  async updateOrganization(
    id: string,
    dto: UpdateOrganizationDto,
    actorId: string,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!org) {
      throw new NotFoundException(`Organización '${id}' no encontrada.`);
    }

    const updated = await this.prisma.organization.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
        description:
          dto.description !== undefined ? dto.description.trim() : undefined,
        settings: dto.settings
          ? (dto.settings as Prisma.InputJsonValue)
          : undefined,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        organizationId: id,
        action: 'ORGANIZATION_UPDATED',
        entity: 'Organization',
        entityId: id,
        previousState: {
          name: org.name,
          description: org.description,
          settings: org.settings,
        },
        newState: {
          name: updated.name,
          description: updated.description,
          settings: updated.settings,
        },
      },
    });

    return updated;
  }

  /**
   * Updates organization status (ACTIVE, INACTIVE, SUSPENDED).
   */
  async updateOrganizationStatus(
    id: string,
    dto: UpdateOrganizationStatusDto,
    actorId: string,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!org) {
      throw new NotFoundException(`Organización '${id}' no encontrada.`);
    }

    const updated = await this.prisma.organization.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        organizationId: id,
        action: 'ORGANIZATION_STATUS_CHANGED',
        entity: 'Organization',
        entityId: id,
        previousState: { status: org.status },
        newState: { status: updated.status, reason: dto.reason },
      },
    });

    return updated;
  }

  /**
   * Atomically transfers the single ADMIN role of an organization to another active member.
   * Enforces: Exactly ONE ADMIN per PYME (§4.2, §19 PRD v1.0).
   */
  async transferAdmin(
    organizationId: string,
    dto: TransferAdminDto,
    actorId: string,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new NotFoundException('Organización no encontrada.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Find target member in this organization
      const targetMembership = await tx.membership.findFirst({
        where: {
          organizationId,
          institutionalPersonId: dto.newAdminPersonId,
        },
        include: {
          institutionalPerson: true,
        },
      });

      if (!targetMembership) {
        throw new NotFoundException(
          'El usuario destino no es miembro de esta organización.',
        );
      }

      if (targetMembership.status !== MembershipStatus.ACTIVE) {
        throw new BadRequestException(
          'No se puede transferir la administración a un miembro suspendido o inactivo.',
        );
      }

      if (targetMembership.role === OrganizationRole.ADMIN) {
        throw new ConflictException(
          'El usuario destino ya es Administrador (ADMIN) de esta organización.',
        );
      }

      // 2. Find current ADMIN
      const currentAdmin = await tx.membership.findFirst({
        where: {
          organizationId,
          role: OrganizationRole.ADMIN,
          status: MembershipStatus.ACTIVE,
        },
      });

      if (currentAdmin) {
        // Demote current ADMIN to USER
        await tx.membership.update({
          where: { id: currentAdmin.id },
          data: {
            role: OrganizationRole.USER,
          },
        });
      }

      // 3. Promote target member to ADMIN
      const updatedAdmin = await tx.membership.update({
        where: { id: targetMembership.id },
        data: {
          role: OrganizationRole.ADMIN,
          permissions: [], // ADMIN inherently has full organizational scope
        },
        include: {
          institutionalPerson: true,
        },
      });

      // 4. Audit event
      await tx.auditLog.create({
        data: {
          actorId,
          organizationId,
          action: 'ADMIN_ROLE_TRANSFERRED',
          entity: 'Membership',
          entityId: updatedAdmin.id,
          previousState: {
            previousAdminMembershipId: currentAdmin?.id,
            previousAdminPersonId: currentAdmin?.institutionalPersonId,
          },
          newState: {
            newAdminMembershipId: updatedAdmin.id,
            newAdminPersonId: dto.newAdminPersonId,
            reason: dto.reason,
          },
        },
      });

      return {
        message: 'Administración de la organización transferida exitosamente.',
        newAdmin: updatedAdmin,
      };
    });
  }

  /**
   * Lists all members of an organization with search and pagination.
   */
  async getMembers(
    organizationId: string,
    role?: OrganizationRole,
    status?: MembershipStatus,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new NotFoundException('Organización no encontrada.');
    }

    const where: Prisma.MembershipWhereInput = {
      organizationId,
    };

    if (role) {
      where.role = role;
    }

    if (status) {
      where.status = status;
    }

    return this.prisma.membership.findMany({
      where,
      include: {
        institutionalPerson: {
          include: {
            studentProfile: true,
            teacherProfile: true,
            authorityProfile: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
  }
}
