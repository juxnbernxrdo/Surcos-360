/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { TokensService } from './tokens.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { TokenStatus, TokenType } from '@prisma/client';

describe('TokensService', () => {
  let service: TokensService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      $executeRaw: jest.fn(),
      registrationToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokensService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<TokensService>(TokensService);
  });

  describe('createToken', () => {
    it('should create a token, store SHA256 hash, and return plaintext token', async () => {
      const mockRecord = {
        id: 'tok-123',
        type: TokenType.STUDENT,
        tokenHash: 'hashed-value',
        status: TokenStatus.ACTIVE,
        maxUses: 1,
        usesCount: 0,
        expiresAt: new Date(),
        createdBy: 'admin-1',
        metadata: {},
      };

      prismaMock.registrationToken.create.mockResolvedValue(mockRecord);
      prismaMock.auditLog.create.mockResolvedValue({});

      const result = await service.createToken(
        { type: TokenType.STUDENT },
        'admin-1',
      );

      expect(result.plaintextToken).toBeDefined();
      expect(result.plaintextToken.startsWith('st_tok_')).toBe(true);
      expect(result.tokenRecord).toEqual(mockRecord);
      expect(prismaMock.registrationToken.create).toHaveBeenCalled();
      expect(prismaMock.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('verifyToken', () => {
    it('should return sanitized token record if valid and active', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const mockRecord = {
        id: 'tok-123',
        type: TokenType.STUDENT,
        status: TokenStatus.ACTIVE,
        expiresAt: futureDate,
        usesCount: 0,
        maxUses: 1,
        metadata: {
          course: '3ro BGU',
          tutor: 'Prof. Gomez',
          internalSecret: 'do-not-leak',
          institutionalPersonId: 'person-secret-id',
        },
      };

      prismaMock.registrationToken.findUnique.mockResolvedValue(mockRecord);

      const res = await service.verifyToken('st_tok_valid123');
      expect(res.id).toBe('tok-123');
      expect(res.status).toBe(TokenStatus.ACTIVE);
      expect(res.metadata.course).toBe('3ro BGU');
      expect(res.metadata.tutor).toBe('Prof. Gomez');
      // Assert sensitive internal fields are sanitized
      expect((res.metadata as any).internalSecret).toBeUndefined();
      expect((res.metadata as any).institutionalPersonId).toBeUndefined();
    });

    it('should throw BadRequestException if token not found', async () => {
      prismaMock.registrationToken.findUnique.mockResolvedValue(null);

      await expect(service.verifyToken('invalid-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if token is expired', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const mockRecord = {
        id: 'tok-123',
        type: TokenType.STUDENT,
        status: TokenStatus.ACTIVE,
        expiresAt: pastDate,
        usesCount: 0,
        maxUses: 1,
        metadata: {},
      };

      prismaMock.registrationToken.findUnique.mockResolvedValue(mockRecord);
      prismaMock.registrationToken.update.mockResolvedValue({});

      await expect(service.verifyToken('st_tok_expired')).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.registrationToken.update).toHaveBeenCalledWith({
        where: { id: 'tok-123' },
        data: { status: TokenStatus.EXPIRED },
      });
    });

    it('should throw BadRequestException if maxUses reached', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const mockRecord = {
        id: 'tok-123',
        type: TokenType.STUDENT,
        status: TokenStatus.ACTIVE,
        expiresAt: futureDate,
        usesCount: 1,
        maxUses: 1,
        metadata: {},
      };

      prismaMock.registrationToken.findUnique.mockResolvedValue(mockRecord);

      await expect(service.verifyToken('st_tok_maxed')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('consumeToken', () => {
    it('should execute atomic update and return updated token record', async () => {
      prismaMock.$executeRaw.mockResolvedValue(1);
      const mockRecord = {
        id: 'tok-1',
        tokenHash: 'some-hash',
        status: TokenStatus.USED,
        usesCount: 1,
        maxUses: 1,
      };
      prismaMock.registrationToken.findUnique.mockResolvedValue(mockRecord);

      const result = await service.consumeToken('st_tok_123');
      expect(result).toEqual(mockRecord);
      expect(prismaMock.$executeRaw).toHaveBeenCalled();
    });

    it('should throw BadRequestException if token has 0 affected rows (expired or already used)', async () => {
      prismaMock.$executeRaw.mockResolvedValue(0);

      await expect(service.consumeToken('st_tok_exhausted')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
