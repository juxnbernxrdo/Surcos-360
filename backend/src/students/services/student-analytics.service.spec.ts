/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { StudentAnalyticsService } from './student-analytics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../../ledger/ledger.service';
import { NotFoundException } from '@nestjs/common';
import {
  UserType,
  EntryDirection,
  TransactionType,
  InstitutionStatus,
  Prisma,
} from '@prisma/client';

const Decimal = Prisma.Decimal;

describe('StudentAnalyticsService', () => {
  let service: StudentAnalyticsService;
  let prisma: PrismaService;
  let ledgerService: LedgerService;

  const mockPrisma = {
    institutionalPerson: {
      findFirst: jest.fn(),
    },
    ledgerEntry: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockLedgerService = {
    getStudentAccountBalance: jest.fn(),
    getStudentAccountBalanceAsOf: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentAnalyticsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LedgerService, useValue: mockLedgerService },
      ],
    }).compile();

    service = module.get<StudentAnalyticsService>(StudentAnalyticsService);
    prisma = module.get<PrismaService>(PrismaService);
    ledgerService = module.get<LedgerService>(LedgerService);

    jest.clearAllMocks();
  });

  describe('getStudentDashboard', () => {
    it('should derive balance, expenses, and format recent activity strictly from ledger', async () => {
      mockPrisma.institutionalPerson.findFirst.mockResolvedValue({
        id: 'person-1',
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan_est@colegiosurcos.edu.ec',
        institutionalCode: 'STU001',
        status: InstitutionStatus.ACTIVE,
        studentProfile: {
          course: '3ro BGU "A"',
          tutor: 'Lic. Morales',
          academicYear: '2026-2027',
        },
        studentAccount: {
          id: 'acc-1',
          accountNumber: 'ACC-STU-123456-7890',
        },
      });

      mockPrisma.ledgerEntry.findMany.mockResolvedValue([
        {
          id: 'e-1',
          direction: EntryDirection.DEBIT,
          amount: new Decimal(8.5),
          createdAt: new Date('2026-08-15T11:30:00Z'),
          transaction: {
            id: 'tx-1',
            type: TransactionType.PURCHASE,
            description: 'Almuerzo nutritivo + Bebida',
            referenceType: 'SALE',
            transactionNumber: 'TX-00984',
            organization: { name: 'AgroRed' },
          },
        },
        {
          id: 'e-2',
          direction: EntryDirection.DEBIT,
          amount: new Decimal(5.0),
          createdAt: new Date('2026-08-14T15:10:00Z'),
          transaction: {
            id: 'tx-2',
            type: TransactionType.VISIT_FEE,
            description: 'Pase diario de entrenamiento',
            referenceType: 'VISIT',
            transactionNumber: 'TX-00980',
            organization: { name: 'Surcos Fit' },
          },
        },
        {
          id: 'e-3',
          direction: EntryDirection.CREDIT,
          amount: new Decimal(100.0),
          createdAt: new Date('2026-08-10T08:30:00Z'),
          transaction: {
            id: 'tx-3',
            type: TransactionType.INITIAL_BALANCE,
            description: 'Saldo inicial de ahorro',
            referenceType: 'STUDENT_ACCOUNT',
            transactionNumber: 'TX-00001',
            organization: { name: 'Surcos Saving' },
          },
        },
      ]);

      mockLedgerService.getStudentAccountBalance.mockResolvedValue(
        new Decimal(86.5),
      );

      const result = await service.getStudentDashboard('person-1');

      expect(result.student.firstName).toBe('Juan');
      expect(result.financials.initialBalance).toBe('100.00');
      expect(result.financials.totalExpenses).toBe('13.50');
      expect(result.financials.currentBalance).toBe('86.50');
      expect(result.financials.savedAmount).toBe('86.50');
      expect(result.recentActivity).toHaveLength(3);
      expect(result.recentActivity[0].storeName).toBe('AgroRed');
      expect(result.recentActivity[0].amount).toBe('-8.50');
      expect(result.recentActivity[1].storeName).toBe('Surcos Fit');
      expect(result.recentActivity[2].storeName).toBe('Surcos Saving');
    });

    it('should throw NotFoundException if student profile is not found', async () => {
      mockPrisma.institutionalPerson.findFirst.mockResolvedValue(null);

      await expect(service.getStudentDashboard('unknown-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if student has no studentAccount', async () => {
      mockPrisma.institutionalPerson.findFirst.mockResolvedValue({
        id: 'person-1',
        studentAccount: null,
      });

      await expect(service.getStudentDashboard('person-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getStudentStatement', () => {
    it('should return paginated entries with PYME resolution and query filters', async () => {
      mockPrisma.institutionalPerson.findFirst.mockResolvedValue({
        id: 'person-1',
        studentAccount: { id: 'acc-1', accountNumber: 'ACC-STU-001' },
      });

      mockPrisma.ledgerEntry.count.mockResolvedValue(1);
      mockPrisma.ledgerEntry.findMany.mockResolvedValue([
        {
          id: 'e-1',
          transactionId: 'tx-1',
          direction: EntryDirection.DEBIT,
          amount: new Decimal(3.0),
          createdAt: new Date('2026-08-12T10:00:00Z'),
          transaction: {
            id: 'tx-1',
            type: TransactionType.RENTAL_FEE,
            description: 'Alquiler Jenga 1h',
            referenceType: 'RENTAL',
            transactionNumber: 'RNT-00120',
            organization: { name: 'Surcasino' },
          },
        },
      ]);
      mockLedgerService.getStudentAccountBalance.mockResolvedValue(
        new Decimal(83.5),
      );

      const result = await service.getStudentStatement('person-1', {
        page: 1,
        limit: 10,
        pyme: 'Surcasino',
      });

      expect(result.total).toBe(1);
      expect(result.currentBalance).toBe('83.50');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].pyme).toBe('Surcasino');
      expect(result.data[0].signedAmount).toBe('-3.00');
    });
  });

  describe('getStudentStatistics', () => {
    it('should compute pyme breakdown percentages, averages and monthly trends from ledger', async () => {
      mockPrisma.institutionalPerson.findFirst.mockResolvedValue({
        id: 'person-1',
        studentAccount: { id: 'acc-1', accountNumber: 'ACC-STU-001' },
      });

      mockPrisma.ledgerEntry.findMany.mockResolvedValue([
        {
          id: 'e-init',
          direction: EntryDirection.CREDIT,
          amount: new Decimal(100),
          createdAt: new Date('2026-08-01T08:00:00Z'),
          transaction: {
            type: TransactionType.INITIAL_BALANCE,
            description: 'Saldo inicial',
            referenceType: 'STUDENT_ACCOUNT',
            organization: { name: 'Surcos Saving' },
          },
        },
        {
          id: 'e-agro',
          direction: EntryDirection.DEBIT,
          amount: new Decimal(15),
          createdAt: new Date('2026-08-05T10:00:00Z'),
          transaction: {
            type: TransactionType.PURCHASE,
            description: 'Snacks',
            referenceType: 'SALE',
            organization: { name: 'AgroRed' },
          },
        },
        {
          id: 'e-fit',
          direction: EntryDirection.DEBIT,
          amount: new Decimal(5),
          createdAt: new Date('2026-08-10T15:00:00Z'),
          transaction: {
            type: TransactionType.VISIT_FEE,
            description: 'Pase',
            referenceType: 'VISIT',
            organization: { name: 'Surcos Fit' },
          },
        },
      ]);

      const stats = await service.getStudentStatistics('person-1');

      expect(stats.summary.totalInflows).toBe('100.00');
      expect(stats.summary.totalExpenses).toBe('20.00');
      expect(stats.summary.currentBalance).toBe('80.00');
      expect(stats.summary.totalPurchases).toBe(1);
      expect(stats.summary.averageExpense).toBe('10.00');
      expect(stats.summary.topSpendingPyme).toBe('AgroRed');

      const agroStat = stats.pymeBreakdown.find((p) => p.pyme === 'AgroRed');
      expect(agroStat?.totalAmount).toBe('15.00');
      expect(agroStat?.percentage).toBe(75);
    });
  });

  describe('getStudentReport', () => {
    it('should generate complete structured financial certificate with opening and closing balances', async () => {
      mockPrisma.institutionalPerson.findFirst.mockResolvedValue({
        id: 'person-1',
        institutionId: 'surcos-main',
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan_est@colegiosurcos.edu.ec',
        institutionalCode: 'STU001',
        studentProfile: {
          course: '3ro BGU',
          academicYear: '2026-2027',
          tutor: 'Lic. Morales',
          representative: {
            phoneNumber: '0987654321',
            identificationNumber: '1799999999',
            institutionalPerson: {
              firstName: 'Carlos',
              lastName: 'Pérez',
              email: 'carlos.perez@gmail.com',
            },
          },
        },
        studentAccount: { id: 'acc-1', accountNumber: 'ACC-STU-001' },
      });

      mockPrisma.ledgerEntry.findMany.mockResolvedValue([
        {
          id: 'e-1',
          direction: EntryDirection.CREDIT,
          amount: new Decimal(50),
          createdAt: new Date('2026-08-01T08:00:00Z'),
          transaction: {
            type: TransactionType.INITIAL_BALANCE,
            description: 'Fondo de ahorro',
            transactionNumber: 'TX-001',
          },
        },
        {
          id: 'e-2',
          direction: EntryDirection.DEBIT,
          amount: new Decimal(10),
          createdAt: new Date('2026-08-05T12:00:00Z'),
          transaction: {
            type: TransactionType.PURCHASE,
            description: 'AgroRed Almuerzo',
            transactionNumber: 'TX-002',
          },
        },
      ]);

      mockLedgerService.getStudentAccountBalanceAsOf.mockResolvedValue(
        new Decimal(0),
      );

      const report = await service.getStudentReport('person-1', {
        startDate: '2026-08-01',
      });
      expect(report.student.fullName).toBe('Juan Pérez');
      expect(report.representative?.name).toBe('Carlos Pérez');
      expect(report.financialSummary.openingBalance).toBe('0.00');
      expect(report.financialSummary.totalCredits).toBe('50.00');
      expect(report.financialSummary.totalDebits).toBe('10.00');
      expect(report.financialSummary.closingBalance).toBe('40.00');
      expect(report.movements).toHaveLength(2);
    });
  });
});
