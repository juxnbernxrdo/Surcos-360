/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationInvitationsService } from './organization-invitations.service';
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
  TokenStatus,
  MembershipStatus,
} from '@prisma/client';

describe('OrganizationInvitationsService', () => {
  let service: OrganizationInvitationsService;
  let prisma: PrismaService;

  const mockPrisma: any = {
    organization: {
      findUnique: jest.fn(),
    },
    institutionalPerson: {
      findUnique: jest.fn(),
    },
    membership: {
      findFirst: jest.fn(),
    },
    organizationInvitation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationInvitationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OrganizationInvitationsService>(
      OrganizationInvitationsService,
    );
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('createInvitation', () => {
    it('should generate CSPRNG token, store SHA-256 hash, and return plaintext token once', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        name: 'AgroRed',
        code: 'AGRORED',
        status: OrganizationStatus.ACTIVE,
      });
      mockPrisma.institutionalPerson.findUnique.mockResolvedValue(null);
      mockPrisma.organizationInvitation.updateMany.mockResolvedValue({
        count: 0,
      });
      mockPrisma.organizationInvitation.create.mockImplementation(
        ({ data }) => ({
          id: 'inv-1',
          organizationId: 'org-1',
          email: data.email,
          role: data.role,
          permissions: data.permissions,
          tokenHash: data.tokenHash,
          status: TokenStatus.ACTIVE,
          expiresAt: data.expiresAt,
          organization: { id: 'org-1', name: 'AgroRed', code: 'AGRORED' },
          inviter: {
            id: 'admin-1',
            firstName: 'Carlos',
            lastName: 'Admin',
            email: 'admin@colegiosurcos.edu.ec',
          },
        }),
      );

      const res = await service.createInvitation(
        'org-1',
        {
          email: 'newmember@colegiosurcos.edu.ec',
          role: OrganizationRole.USER,
          permissions: ['inventory.read', 'sales.create'],
          expiresInDays: 7,
        },
        'admin-1',
      );

      expect(res.plaintextToken).toBeDefined();
      expect(res.plaintextToken).toMatch(/^org_inv_[0-9a-f]{64}$/);
      expect(res.invitation.email).toBe('newmember@colegiosurcos.edu.ec');
      expect(res.invitation.role).toBe(OrganizationRole.USER);

      // Verify that plain token is NOT passed to prisma create, only tokenHash
      expect(mockPrisma.organizationInvitation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tokenHash: service.hashToken(res.plaintextToken),
          organizationId: 'org-1',
        }),
        include: expect.any(Object),
      });

      // Verify audit trail
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'ORGANIZATION_INVITATION_CREATED',
          organizationId: 'org-1',
        }),
      });
    });

    it('should reject invitation if organization is inactive or suspended', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        status: OrganizationStatus.SUSPENDED,
      });

      await expect(
        service.createInvitation(
          'org-1',
          { email: 'test@colegiosurcos.edu.ec' },
          'admin-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject invitation if user is already an active member of the organization', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        status: OrganizationStatus.ACTIVE,
      });
      mockPrisma.institutionalPerson.findUnique.mockResolvedValue({
        id: 'p-1',
        email: 'existing@colegiosurcos.edu.ec',
        memberships: [{ organizationId: 'org-1', status: 'ACTIVE' }],
      });

      await expect(
        service.createInvitation(
          'org-1',
          { email: 'existing@colegiosurcos.edu.ec' },
          'admin-1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject inviting as ADMIN if an active ADMIN already exists in the organization', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        status: OrganizationStatus.ACTIVE,
      });
      mockPrisma.institutionalPerson.findUnique.mockResolvedValue(null);
      mockPrisma.membership.findFirst.mockResolvedValue({
        id: 'existing-admin',
        role: OrganizationRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      });

      await expect(
        service.createInvitation(
          'org-1',
          {
            email: 'admin2@colegiosurcos.edu.ec',
            role: OrganizationRole.ADMIN,
          },
          'admin-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyInvitation', () => {
    it('should verify and return sanitized invitation data for a valid active token', async () => {
      const rawToken = 'org_inv_test123';
      const tokenHash = service.hashToken(rawToken);

      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        organizationId: 'org-1',
        email: 'invited@colegiosurcos.edu.ec',
        role: OrganizationRole.USER,
        permissions: ['inventory.read'],
        status: TokenStatus.ACTIVE,
        maxUses: 1,
        usesCount: 0,
        expiresAt: new Date(Date.now() + 1000000),
        organization: {
          id: 'org-1',
          name: 'AgroRed',
          code: 'AGRORED',
          status: OrganizationStatus.ACTIVE,
        },
        inviter: {
          firstName: 'Mario',
          lastName: 'Gomez',
          email: 'mario@surcos.ec',
        },
      });

      const res = await service.verifyInvitation(rawToken);

      expect(res.organizationName).toBe('AgroRed');
      expect(res.email).toBe('invited@colegiosurcos.edu.ec');
      expect(res.role).toBe(OrganizationRole.USER);
    });

    it('should mark invitation EXPIRED and throw BadRequestException if expiration date has passed', async () => {
      const rawToken = 'org_inv_expired';
      const tokenHash = service.hashToken(rawToken);

      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: 'inv-expired',
        tokenHash,
        status: TokenStatus.ACTIVE,
        maxUses: 1,
        usesCount: 0,
        expiresAt: new Date(Date.now() - 100000), // Past
        organization: { status: OrganizationStatus.ACTIVE },
        inviter: { firstName: 'A', lastName: 'B', email: 'a@b.com' },
      });

      await expect(service.verifyInvitation(rawToken)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.organizationInvitation.update).toHaveBeenCalledWith({
        where: { id: 'inv-expired' },
        data: { status: TokenStatus.EXPIRED },
      });
    });
  });

  describe('revokeInvitation', () => {
    it('should revoke active invitation and record audit log', async () => {
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        organizationId: 'org-1',
        status: TokenStatus.ACTIVE,
      });
      mockPrisma.organizationInvitation.update.mockResolvedValue({
        id: 'inv-1',
        status: TokenStatus.REVOKED,
      });

      const res = await service.revokeInvitation('org-1', 'inv-1', 'admin-1');

      expect(res.message).toContain('revocada exitosamente');
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'ORGANIZATION_INVITATION_REVOKED',
          entityId: 'inv-1',
        }),
      });
    });
  });
});
