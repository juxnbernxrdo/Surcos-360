/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { LedgerService } from './ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  EntryDirection,
  TransactionType,
  AccountType,
  Prisma,
} from '@prisma/client';

const Decimal = Prisma.Decimal;

describe('LedgerService (Financial Engine & Invariants)', () => {
  let service: LedgerService;
  let prisma: PrismaService;

  const mockPrisma: any = {
    $transaction: jest.fn((cb) => cb(mockPrisma)),
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'lock-target' }]),
    $executeRaw: jest.fn().mockResolvedValue(undefined),
    transaction: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    ledgerEntry: {
      create: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    ledgerAccount: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    studentAccount: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('createTransaction (Double-Entry Invariants §5, §7.3 PRD v1.0)', () => {
    it('should reject transactions with fewer than 2 entries', async () => {
      await expect(
        service.createTransaction({
          type: TransactionType.PURCHASE,
          description: 'Invalid single entry',
          actorId: 'actor-1',
          entries: [
            {
              ledgerAccountId: 'acc-1',
              direction: EntryDirection.DEBIT,
              amount: '100.00',
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject transactions with any non-positive amount (amount <= 0)', async () => {
      await expect(
        service.createTransaction({
          type: TransactionType.PURCHASE,
          description: 'Zero amount entry',
          actorId: 'actor-1',
          entries: [
            {
              ledgerAccountId: 'acc-1',
              direction: EntryDirection.DEBIT,
              amount: '0.00',
            },
            {
              ledgerAccountId: 'acc-2',
              direction: EntryDirection.CREDIT,
              amount: '0.00',
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unbalanced transactions where SUM(Debits) != SUM(Credits)', async () => {
      await expect(
        service.createTransaction({
          type: TransactionType.PURCHASE,
          description: 'Unbalanced tx',
          actorId: 'actor-1',
          entries: [
            {
              ledgerAccountId: 'acc-1',
              direction: EntryDirection.DEBIT,
              amount: '100.50',
            },
            {
              ledgerAccountId: 'acc-2',
              direction: EntryDirection.CREDIT,
              amount: '99.50',
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create a balanced double-entry transaction and persist entries atomically', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(null);
      mockPrisma.transaction.create.mockResolvedValue({
        id: 'tx-100',
        transactionNumber: 'TX-123456-7890',
        type: TransactionType.PURCHASE,
        description: 'Venta balanceada',
        actorId: 'actor-1',
        organizationId: 'org-1',
      });
      mockPrisma.ledgerEntry.create
        .mockResolvedValueOnce({
          id: 'entry-1',
          transactionId: 'tx-100',
          ledgerAccountId: 'acc-1',
          direction: EntryDirection.DEBIT,
          amount: new Decimal('100.50'),
        })
        .mockResolvedValueOnce({
          id: 'entry-2',
          transactionId: 'tx-100',
          ledgerAccountId: 'acc-2',
          direction: EntryDirection.CREDIT,
          amount: new Decimal('100.50'),
        });

      const res = await service.createTransaction({
        type: TransactionType.PURCHASE,
        description: 'Venta balanceada',
        organizationId: 'org-1',
        actorId: 'actor-1',
        entries: [
          {
            ledgerAccountId: 'acc-1',
            direction: EntryDirection.DEBIT,
            amount: '100.50',
          },
          {
            ledgerAccountId: 'acc-2',
            direction: EntryDirection.CREDIT,
            amount: '100.50',
          },
        ],
      });

      expect(res.id).toBe('tx-100');
      expect(mockPrisma.transaction.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.ledgerEntry.create).toHaveBeenCalledTimes(2);
    });

    it('should support multi-leg balanced transactions (e.g. split debits/credits)', async () => {
      mockPrisma.transaction.create.mockResolvedValue({
        id: 'tx-split',
        transactionNumber: 'TX-SPLIT-1',
      });
      mockPrisma.ledgerEntry.create.mockResolvedValue({ id: 'entry-leg' });

      const res = await service.createTransaction({
        type: TransactionType.PURCHASE,
        description: 'Split payment',
        actorId: 'actor-1',
        entries: [
          {
            studentAccountId: 'stu-1',
            direction: EntryDirection.DEBIT,
            amount: '30.00',
          },
          {
            ledgerAccountId: 'cash-vault',
            direction: EntryDirection.DEBIT,
            amount: '70.00',
          },
          {
            ledgerAccountId: 'revenue-acc',
            direction: EntryDirection.CREDIT,
            amount: '100.00',
          },
        ],
      });

      expect(res.id).toBe('tx-split');
      expect(mockPrisma.ledgerEntry.create).toHaveBeenCalledTimes(3);
    });

    it('should return existing transaction if idempotencyKey is already recorded', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'tx-cached',
        idempotencyKey: 'idem-key-1',
        entries: [],
      });

      const res = await service.createTransaction({
        type: TransactionType.PURCHASE,
        description: 'Idempotent request',
        idempotencyKey: 'idem-key-1',
        actorId: 'actor-1',
        entries: [
          {
            ledgerAccountId: 'acc-1',
            direction: EntryDirection.DEBIT,
            amount: '50.00',
          },
          {
            ledgerAccountId: 'acc-2',
            direction: EntryDirection.CREDIT,
            amount: '50.00',
          },
        ],
      });

      expect(res.id).toBe('tx-cached');
      expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
    });
  });

  describe('getStudentAccountBalance (§7.3 PRD v1.0)', () => {
    it('should derive balance as SUM(CREDITS) - SUM(DEBITS)', async () => {
      mockPrisma.ledgerEntry.findMany.mockResolvedValue([
        { direction: EntryDirection.CREDIT, amount: new Decimal('100.00') }, // Initial deposit
        { direction: EntryDirection.DEBIT, amount: new Decimal('25.50') }, // Purchase
        { direction: EntryDirection.DEBIT, amount: new Decimal('10.00') }, // Gym visit
        { direction: EntryDirection.CREDIT, amount: new Decimal('5.00') }, // Refund
      ]);

      const balance = await service.getStudentAccountBalance('stu-acc-1');
      // 100 - 25.50 - 10.00 + 5.00 = 69.50
      expect(balance.toString()).toBe('69.5');
    });

    it('should return 0 when no ledger entries exist for student', async () => {
      mockPrisma.ledgerEntry.findMany.mockResolvedValue([]);
      const balance = await service.getStudentAccountBalance('stu-acc-empty');
      expect(balance.toString()).toBe('0');
    });
  });

  describe('getLedgerAccountBalance (§7.3 PRD v1.0)', () => {
    it('should calculate ASSET balance as DEBITS - CREDITS', async () => {
      mockPrisma.ledgerAccount.findUnique.mockResolvedValue({
        id: 'cash-vault',
        type: AccountType.ASSET,
      });
      mockPrisma.ledgerEntry.findMany.mockResolvedValue([
        { direction: EntryDirection.DEBIT, amount: new Decimal('500.00') },
        { direction: EntryDirection.CREDIT, amount: new Decimal('150.00') },
      ]);

      const balance = await service.getLedgerAccountBalance('cash-vault');
      expect(balance.toString()).toBe('350');
    });

    it('should calculate REVENUE balance as CREDITS - DEBITS', async () => {
      mockPrisma.ledgerAccount.findUnique.mockResolvedValue({
        id: 'rev-acc',
        type: AccountType.REVENUE,
      });
      mockPrisma.ledgerEntry.findMany.mockResolvedValue([
        { direction: EntryDirection.CREDIT, amount: new Decimal('1200.00') },
        { direction: EntryDirection.DEBIT, amount: new Decimal('50.00') }, // Refund/Adjustment
      ]);

      const balance = await service.getLedgerAccountBalance('rev-acc');
      expect(balance.toString()).toBe('1150');
    });
  });

  describe('reverseTransaction (§18, §19 PRD v1.0)', () => {
    it('should reject reversing a transaction that does not exist', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(null);
      await expect(
        service.reverseTransaction('missing-tx', { reason: 'Test' }, 'actor-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject reversing a transaction that is already a REVERSAL', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'rev-tx',
        type: TransactionType.REVERSAL,
        entries: [],
      });
      await expect(
        service.reverseTransaction('rev-tx', { reason: 'Test' }, 'actor-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject reversing a transaction that has already been reversed', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'orig-tx',
        type: TransactionType.PURCHASE,
        entries: [],
      });
      mockPrisma.transaction.findFirst.mockResolvedValue({
        id: 'prior-reversal',
        reversalOfId: 'orig-tx',
      });

      await expect(
        service.reverseTransaction('orig-tx', { reason: 'Test' }, 'actor-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should create an immutable reversing transaction swapping debits with credits', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'tx-to-reverse',
        transactionNumber: 'TX-111111-2222',
        type: TransactionType.PURCHASE,
        description: 'Original purchase',
        organizationId: 'org-1',
        entries: [
          {
            studentAccountId: 'stu-1',
            ledgerAccountId: null,
            direction: EntryDirection.DEBIT,
            amount: new Decimal('45.00'),
          },
          {
            studentAccountId: null,
            ledgerAccountId: 'rev-acc',
            direction: EntryDirection.CREDIT,
            amount: new Decimal('45.00'),
          },
        ],
      });
      mockPrisma.transaction.findFirst.mockResolvedValue(null);
      mockPrisma.transaction.create.mockResolvedValue({
        id: 'tx-rev-new',
        transactionNumber: 'REV-999999-1111',
        type: TransactionType.REVERSAL,
      });
      mockPrisma.ledgerEntry.create.mockResolvedValue({ id: 'rev-entry' });
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

      const res = await service.reverseTransaction(
        'tx-to-reverse',
        { reason: 'Cancelación solicitada' },
        'actor-1',
      );

      expect(res.id).toBe('tx-rev-new');
      expect(mockPrisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: TransactionType.REVERSAL,
            reversalOfId: 'tx-to-reverse',
          }),
        }),
      );
      expect(mockPrisma.ledgerEntry.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('depositToStudentAccount & withdrawFromStudentAccount (§7.1, §8 PRD v1.0)', () => {
    it('should deposit funds into student savings account', async () => {
      mockPrisma.studentAccount.findUnique.mockResolvedValue({
        id: 'stu-acc-1',
        institutionalPerson: { firstName: 'Juan', lastName: 'Perez' },
      });
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-saving',
        code: 'SAVING',
      });
      mockPrisma.ledgerAccount.findUnique.mockResolvedValue({
        id: 'central-vault',
        code: 'SAVING_CENTRAL_VAULT',
      });
      mockPrisma.transaction.create.mockResolvedValue({
        id: 'tx-dep',
        type: TransactionType.DEPOSIT,
      });
      mockPrisma.ledgerEntry.create.mockResolvedValue({ id: 'e-1' });

      const res = await service.depositToStudentAccount(
        'stu-acc-1',
        { amount: '50.00', description: 'Aporte mensual' },
        'admin-1',
      );

      expect(res.id).toBe('tx-dep');
    });

    it('should reject withdrawal if student account has insufficient balance', async () => {
      mockPrisma.studentAccount.findUnique.mockResolvedValue({
        id: 'stu-acc-1',
        institutionalPerson: { firstName: 'Juan', lastName: 'Perez' },
      });
      // Mock balance of 20
      mockPrisma.ledgerEntry.findMany.mockResolvedValue([
        { direction: EntryDirection.CREDIT, amount: new Decimal('20.00') },
      ]);

      await expect(
        service.withdrawFromStudentAccount(
          'stu-acc-1',
          { amount: '50.00', description: 'Retiro excesivo' },
          'admin-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });
});
