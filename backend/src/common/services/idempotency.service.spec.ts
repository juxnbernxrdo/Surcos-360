/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { IdempotencyService } from './idempotency.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let prisma: PrismaService;

  const mockPrisma = {
    idempotencyKey: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should hash payloads deterministically', () => {
    const hash1 = service.hashPayload({ amount: 100, studentId: '123' });
    const hash2 = service.hashPayload({ amount: 100, studentId: '123' });
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('should find stored key', async () => {
    mockPrisma.idempotencyKey.findUnique.mockResolvedValue({
      id: 'k-1',
      key: 'test-key',
      responseData: { success: true },
    });

    const res = await service.findKey('test-key', 'actor-1', 'POST /sale');
    expect(res?.key).toBe('test-key');
  });
});
