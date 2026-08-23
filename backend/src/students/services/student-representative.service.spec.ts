/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { StudentRepresentativeService } from './student-representative.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TokensService } from '../../auth/services/tokens.service';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TokenType, TokenStatus, UserType } from '@prisma/client';

describe('StudentRepresentativeService', () => {
  let service: StudentRepresentativeService;
  let prisma: PrismaService;
  let tokensService: TokensService;

  const mockPrisma = {
    institutionalPerson: {
      findFirst: jest.fn(),
    },
    registrationToken: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    studentProfile: {
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  const mockTokensService = {
    createToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentRepresentativeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TokensService, useValue: mockTokensService },
      ],
    }).compile();

    service = module.get<StudentRepresentativeService>(
      StudentRepresentativeService,
    );
    prisma = module.get<PrismaService>(PrismaService);
    tokensService = module.get<TokensService>(TokensService);

    jest.clearAllMocks();
  });

  describe('getStudentRepresentative', () => {
    it('should return representative details when linked', async () => {
      mockPrisma.institutionalPerson.findFirst.mockResolvedValue({
        id: 'student-1',
        studentProfile: {
          id: 'sp-1',
          representative: {
            id: 'rep-1',
            phoneNumber: '0987654321',
            identificationNumber: '1712345678',
            createdAt: new Date(),
            institutionalPerson: {
              id: 'rep-p-1',
              firstName: 'Laura',
              lastName: 'Mendoza',
              email: 'laura.mendoza@gmail.com',
            },
          },
        },
      });

      const result = await service.getStudentRepresentative('student-1');

      expect(result.hasRepresentative).toBe(true);
      expect(result.representative?.firstName).toBe('Laura');
      expect(result.representative?.email).toBe('laura.mendoza@gmail.com');
      expect(result.pendingInvitation).toBeNull();
    });

    it('should return pending invitation info when representative is not yet linked', async () => {
      mockPrisma.institutionalPerson.findFirst.mockResolvedValue({
        id: 'student-1',
        studentProfile: { representative: null },
      });

      const futureDate = new Date(Date.now() + 86400000);
      mockPrisma.registrationToken.findMany.mockResolvedValue([
        {
          id: 'tok-1',
          status: TokenStatus.ACTIVE,
          expiresAt: futureDate,
          metadata: { parentEmail: 'parent@gmail.com' },
        },
      ]);

      const result = await service.getStudentRepresentative('student-1');

      expect(result.hasRepresentative).toBe(false);
      expect(result.representative).toBeNull();
      expect(result.pendingInvitation?.id).toBe('tok-1');
    });
  });

  describe('createRepresentativeInvitation', () => {
    it('should generate 48h invitation token and revoke previous tokens under single-rep rule', async () => {
      mockPrisma.institutionalPerson.findFirst.mockResolvedValue({
        id: 'student-1',
        firstName: 'Esteban',
        lastName: 'Paz',
        institutionalCode: 'STU050',
        studentProfile: { id: 'sp-1', representativeId: null, course: '2do BGU' },
      });

      const expiresAt = new Date(Date.now() + 172800000);
      mockTokensService.createToken.mockResolvedValue({
        plaintextToken: 'rep_tok_crypto_abc123',
        tokenRecord: { id: 'tok-rec-1', expiresAt },
      });

      const result = await service.createRepresentativeInvitation(
        'student-1',
        { parentEmail: 'parent@gmail.com', parentName: 'Carlos Paz' },
        'student-1',
      );

      expect(mockPrisma.registrationToken.updateMany).toHaveBeenCalledWith({
        where: {
          type: TokenType.REPRESENTATIVE,
          status: TokenStatus.ACTIVE,
          createdBy: 'student-1',
        },
        data: {
          status: TokenStatus.REVOKED,
        },
      });

      expect(mockTokensService.createToken).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TokenType.REPRESENTATIVE,
          maxUses: 1,
          expiresInDays: 2,
        }),
        'student-1',
      );

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'REPRESENTATIVE_INVITED',
          }),
        }),
      );

      expect(result.token).toBe('rep_tok_crypto_abc123');
      expect(result.invitationUrl).toContain('rep_tok_crypto_abc123');
    });

    it('should throw ConflictException if student already has a representative linked', async () => {
      mockPrisma.institutionalPerson.findFirst.mockResolvedValue({
        id: 'student-1',
        studentProfile: { representativeId: 'rep-existing-123' },
      });

      await expect(
        service.createRepresentativeInvitation('student-1', {
          parentEmail: 'newparent@gmail.com',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('unlinkRepresentative', () => {
    it('should unlink representative and create audit logs', async () => {
      mockPrisma.institutionalPerson.findFirst.mockResolvedValue({
        id: 'student-1',
        userType: UserType.STUDENT,
        studentProfile: {
          id: 'sp-1',
          representativeId: 'rep-profile-1',
        },
      });

      const result = await service.unlinkRepresentative(
        'student-1',
        'authority-actor',
      );

      expect(mockPrisma.studentProfile.update).toHaveBeenCalledWith({
        where: { id: 'sp-1' },
        data: { representativeId: null },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'REPRESENTATIVE_UNLINKED',
          }),
        }),
      );
      expect(result.success).toBe(true);
    });

    it('should throw BadRequestException if student has no representative linked', async () => {
      mockPrisma.institutionalPerson.findFirst.mockResolvedValue({
        id: 'student-1',
        userType: UserType.STUDENT,
        studentProfile: { id: 'sp-1', representativeId: null },
      });

      await expect(
        service.unlinkRepresentative('student-1', 'authority-actor'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
