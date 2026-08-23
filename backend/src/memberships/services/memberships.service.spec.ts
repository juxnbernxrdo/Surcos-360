/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { MembershipsService } from './memberships.service';
import { OrganizationInvitationsService } from '../../organizations/services/organization-invitations.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  OrganizationRole,
  OrganizationStatus,
  MembershipStatus,
  InstitutionStatus,
  TokenStatus,
} from '@prisma/client';

describe('MembershipsService', () => {
  let service: MembershipsService;
  let prisma: PrismaService;
  let invitationsService: OrganizationInvitationsService;

  const mockPrisma: any = {
    organization: {
      findUnique: jest.fn(),
    },
    institutionalPerson: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    membership: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    organizationInvitation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrisma)),
  };

  const mockInvitationsService = {
    hashToken: jest.fn((t) => `hashed_${t}`),
    verifyInvitation: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipsService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: OrganizationInvitationsService,
          useValue: mockInvitationsService,
        },
      ],
    }).compile();

    service = module.get<MembershipsService>(MembershipsService);
    prisma = module.get<PrismaService>(PrismaService);
    invitationsService = module.get<OrganizationInvitationsService>(
      OrganizationInvitationsService,
    );
    jest.clearAllMocks();
  });

  describe('addDirectMember', () => {
    it('should add an active member with USER role and granular permissions', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        status: OrganizationStatus.ACTIVE,
      });
      mockPrisma.institutionalPerson.findUnique.mockResolvedValue({
        id: 'person-1',
        status: InstitutionStatus.ACTIVE,
      });
      mockPrisma.membership.findUnique.mockResolvedValue(null);
      mockPrisma.membership.create.mockResolvedValue({
        id: 'mem-1',
        organizationId: 'org-1',
        institutionalPersonId: 'person-1',
        role: OrganizationRole.USER,
        permissions: ['inventory.read', 'sales.create'],
        status: MembershipStatus.ACTIVE,
      });

      const res = await service.addDirectMember(
        'org-1',
        {
          institutionalPersonId: 'person-1',
          role: OrganizationRole.USER,
          permissions: ['inventory.read', 'sales.create'],
        },
        'actor-admin',
      );

      expect(res.id).toBe('mem-1');
      expect(res.role).toBe(OrganizationRole.USER);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'MEMBERSHIP_CREATED',
          organizationId: 'org-1',
        }),
      });
    });

    it('should reject adding a second ADMIN to an organization', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        status: OrganizationStatus.ACTIVE,
      });
      mockPrisma.institutionalPerson.findUnique.mockResolvedValue({
        id: 'person-2',
        status: InstitutionStatus.ACTIVE,
      });
      mockPrisma.membership.findUnique.mockResolvedValue(null);
      mockPrisma.membership.findFirst.mockResolvedValue({
        id: 'existing-admin-id',
        role: OrganizationRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      });

      await expect(
        service.addDirectMember(
          'org-1',
          {
            institutionalPersonId: 'person-2',
            role: OrganizationRole.ADMIN,
          },
          'actor-admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject adding a member if person is already an active member', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        status: OrganizationStatus.ACTIVE,
      });
      mockPrisma.institutionalPerson.findUnique.mockResolvedValue({
        id: 'person-1',
        status: InstitutionStatus.ACTIVE,
      });
      mockPrisma.membership.findUnique.mockResolvedValue({
        id: 'mem-1',
        status: MembershipStatus.ACTIVE,
      });

      await expect(
        service.addDirectMember(
          'org-1',
          {
            institutionalPersonId: 'person-1',
          },
          'actor-admin',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('claimInvitation', () => {
    it('should atomically claim an invitation, create membership, and mark invitation USED', async () => {
      const rawToken = 'org_inv_claim_test';
      const tokenHash = `hashed_${rawToken}`;

      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        organizationId: 'org-1',
        role: OrganizationRole.USER,
        permissions: ['inventory.read'],
        status: TokenStatus.ACTIVE,
        maxUses: 1,
        usesCount: 0,
        expiresAt: new Date(Date.now() + 100000),
        invitedBy: 'inviter-id',
        organization: { status: OrganizationStatus.ACTIVE },
      });

      mockPrisma.institutionalPerson.findUnique.mockResolvedValue({
        id: 'person-claimant',
        status: InstitutionStatus.ACTIVE,
      });

      mockPrisma.membership.findUnique.mockResolvedValue(null);
      mockPrisma.membership.create.mockResolvedValue({
        id: 'mem-new',
        organizationId: 'org-1',
        institutionalPersonId: 'person-claimant',
        role: OrganizationRole.USER,
        permissions: ['inventory.read'],
        status: MembershipStatus.ACTIVE,
      });

      const res = await service.claimInvitation(
        { token: rawToken },
        'person-claimant',
      );

      expect(res.message).toContain('Membresía creada');
      expect(mockPrisma.organizationInvitation.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: expect.objectContaining({
          status: TokenStatus.USED,
          usesCount: 1,
        }),
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ORGANIZATION_INVITATION_ACCEPTED',
          }),
        }),
      );
    });
  });

  describe('updateStatus & ADMIN Protection', () => {
    it('should reject suspending or revoking the sole ADMIN of an organization', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue({
        id: 'mem-admin',
        organizationId: 'org-1',
        role: OrganizationRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      });

      await expect(
        service.updateStatus(
          'mem-admin',
          { status: MembershipStatus.SUSPENDED },
          'actor-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow suspending an ordinary USER member and record audit', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue({
        id: 'mem-user',
        organizationId: 'org-1',
        role: OrganizationRole.USER,
        status: MembershipStatus.ACTIVE,
      });
      mockPrisma.membership.update.mockResolvedValue({
        id: 'mem-user',
        status: MembershipStatus.SUSPENDED,
      });

      const res = await service.updateStatus(
        'mem-user',
        { status: MembershipStatus.SUSPENDED, reason: 'Temporary leave' },
        'actor-admin',
      );

      expect(res.status).toBe(MembershipStatus.SUSPENDED);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'MEMBERSHIP_STATUS_CHANGED',
          entityId: 'mem-user',
        }),
      });
    });
  });

  describe('removeMember', () => {
    it('should reject deleting the sole ADMIN of an organization', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue({
        id: 'mem-admin',
        organizationId: 'org-1',
        role: OrganizationRole.ADMIN,
      });

      await expect(
        service.removeMember('mem-admin', 'actor-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should delete member without deleting institutional person or user account', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue({
        id: 'mem-user',
        organizationId: 'org-1',
        institutionalPersonId: 'person-user',
        role: OrganizationRole.USER,
        permissions: ['inventory.read'],
      });
      mockPrisma.membership.delete.mockResolvedValue({ id: 'mem-user' });

      const res = await service.removeMember('mem-user', 'actor-admin');

      expect(mockPrisma.membership.delete).toHaveBeenCalledWith({
        where: { id: 'mem-user' },
      });
      // Institutional person must NOT be deleted
      expect(mockPrisma.institutionalPerson.create).not.toHaveBeenCalled();
      expect(res.message).toContain('permanece intacta');
    });
  });
});
