/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { InstitutionStatus, UserType } from '@prisma/client';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  const mockPrisma = {
    institutionalPerson: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should return user profile with institutional details', async () => {
      mockPrisma.institutionalPerson.findFirst.mockResolvedValue({
        id: 'p-1',
        userId: 'u-1',
        firstName: 'Maria',
        lastName: 'Lopez',
        memberships: [],
      });

      const res = await service.getProfile('u-1');
      expect(res.id).toBe('p-1');
      expect(res.firstName).toBe('Maria');
    });

    it('should throw NotFoundException if profile does not exist', async () => {
      mockPrisma.institutionalPerson.findFirst.mockResolvedValue(null);
      await expect(service.getProfile('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStatus', () => {
    it('should update status and record audit log', async () => {
      mockPrisma.institutionalPerson.findUnique.mockResolvedValue({
        id: 'p-1',
        status: InstitutionStatus.ACTIVE,
      });
      mockPrisma.institutionalPerson.update.mockResolvedValue({
        id: 'p-1',
        status: InstitutionStatus.SUSPENDED,
      });

      const res = await service.updateStatus(
        'p-1',
        { status: InstitutionStatus.SUSPENDED },
        'admin-1',
      );

      expect(res.status).toBe(InstitutionStatus.SUSPENDED);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'UPDATE_USER_STATUS',
            entityId: 'p-1',
          }),
        }),
      );
    });
  });

  describe('linkIdentity', () => {
    it('should link institutional person to Supabase userId and audit', async () => {
      mockPrisma.institutionalPerson.findUnique
        .mockResolvedValueOnce({ id: 'p-1', userId: null }) // person lookup
        .mockResolvedValueOnce(null); // existing user check

      mockPrisma.institutionalPerson.update.mockResolvedValue({
        id: 'p-1',
        userId: 'supabase-uid-1',
      });

      const res = await service.linkIdentity(
        { institutionalPersonId: 'p-1', userId: 'supabase-uid-1' },
        'admin-1',
      );

      expect(res.userId).toBe('supabase-uid-1');
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if person already linked', async () => {
      mockPrisma.institutionalPerson.findUnique.mockResolvedValueOnce({
        id: 'p-1',
        userId: 'already-linked',
      });

      await expect(
        service.linkIdentity(
          { institutionalPersonId: 'p-1', userId: 'new-uid' },
          'admin-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });
});
