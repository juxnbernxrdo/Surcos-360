/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationsService } from './organizations.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  OrganizationRole,
  OrganizationStatus,
  MembershipStatus,
} from '@prisma/client';

import { LedgerService } from '../../ledger/ledger.service';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prisma: PrismaService;

  const mockLedgerService = {
    ensureOrganizationAccounts: jest.fn().mockResolvedValue(undefined),
    getOrganizationAccount: jest.fn(),
  };

  const mockPrisma: any = {
    organization: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    membership: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrisma)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LedgerService, useValue: mockLedgerService },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('createOrganization', () => {
    it('should create an organization with normalized uppercase code, active status, and audit log', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      mockPrisma.organization.create.mockResolvedValue({
        id: 'org-1',
        name: 'AgroRed',
        code: 'AGRORED',
        isPyme: true,
        status: OrganizationStatus.ACTIVE,
      });

      const res = await service.createOrganization(
        { name: 'AgroRed', code: 'agrored', isPyme: true },
        'auth-actor-1',
      );

      expect(res.code).toBe('AGRORED');
      expect(mockPrisma.organization.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          code: 'AGRORED',
          status: OrganizationStatus.ACTIVE,
        }),
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'ORGANIZATION_CREATED',
          entityId: 'org-1',
        }),
      });
    });

    it('should throw ConflictException if organization code is already taken', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'existing-id',
      });

      await expect(
        service.createOrganization(
          { name: 'Duplicate', code: 'AGRORED' },
          'auth-actor-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('transferAdmin', () => {
    it('should atomically transfer ADMIN role from current admin to another active member', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        name: 'AgroRed',
      });

      mockPrisma.membership.findFirst
        .mockResolvedValueOnce({
          id: 'mem-target',
          organizationId: 'org-1',
          institutionalPersonId: 'person-target',
          role: OrganizationRole.USER,
          status: MembershipStatus.ACTIVE,
        })
        .mockResolvedValueOnce({
          id: 'mem-current-admin',
          organizationId: 'org-1',
          institutionalPersonId: 'person-current',
          role: OrganizationRole.ADMIN,
          status: MembershipStatus.ACTIVE,
        });

      mockPrisma.membership.update
        .mockResolvedValueOnce({
          id: 'mem-current-admin',
          role: OrganizationRole.USER,
        })
        .mockResolvedValueOnce({
          id: 'mem-target',
          role: OrganizationRole.ADMIN,
          permissions: [],
          institutionalPerson: { id: 'person-target' },
        });

      const result = await service.transferAdmin(
        'org-1',
        {
          newAdminPersonId: 'person-target',
          reason: 'Annual leadership handover',
        },
        'actor-admin',
      );

      expect(result.message).toContain('transferida exitosamente');
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ADMIN_ROLE_TRANSFERRED',
            organizationId: 'org-1',
          }),
        }),
      );
    });

    it('should reject transferring ADMIN role to a suspended member', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org-1' });
      mockPrisma.membership.findFirst.mockResolvedValueOnce({
        id: 'mem-suspended',
        organizationId: 'org-1',
        institutionalPersonId: 'person-suspended',
        role: OrganizationRole.USER,
        status: MembershipStatus.SUSPENDED,
      });

      await expect(
        service.transferAdmin(
          'org-1',
          { newAdminPersonId: 'person-suspended' },
          'actor-admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject transferring ADMIN role if target is not a member of the organization', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org-1' });
      mockPrisma.membership.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.transferAdmin(
          'org-1',
          { newAdminPersonId: 'non-member' },
          'actor-admin',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateOrganizationStatus', () => {
    it('should update organization status and generate audit log', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        status: OrganizationStatus.ACTIVE,
      });
      mockPrisma.organization.update.mockResolvedValue({
        id: 'org-1',
        status: OrganizationStatus.SUSPENDED,
      });

      const res = await service.updateOrganizationStatus(
        'org-1',
        { status: OrganizationStatus.SUSPENDED, reason: 'Annual audit' },
        'auth-actor',
      );

      expect(res.status).toBe(OrganizationStatus.SUSPENDED);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'ORGANIZATION_STATUS_CHANGED',
          entityId: 'org-1',
        }),
      });
    });
  });
});
