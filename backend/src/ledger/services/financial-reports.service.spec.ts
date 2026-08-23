/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { FinancialReportsService } from './financial-reports.service';
import { LedgerService } from '../ledger.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountType, EntryDirection, Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

describe('FinancialReportsService (Trial Balance, P&L, Balance Sheet)', () => {
  let service: FinancialReportsService;
  let prisma: PrismaService;

  const mockPrisma: any = {
    organization: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    ledgerAccount: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    ledgerEntry: {
      findMany: jest.fn(),
    },
    studentAccount: {
      count: jest.fn(),
    },
  };

  const mockLedgerService = {
    getLedgerAccountBalance: jest.fn(),
    getStudentAccountBalance: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialReportsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LedgerService, useValue: mockLedgerService },
      ],
    }).compile();

    service = module.get<FinancialReportsService>(FinancialReportsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('getTrialBalance (§28 PRD v1.0)', () => {
    it('should generate a balanced trial balance with SUM(Debits) == SUM(Credits)', async () => {
      mockPrisma.ledgerAccount.findMany.mockResolvedValue([
        {
          id: 'acc-cash',
          code: 'AGRORED_CASH_VAULT',
          name: 'AgroRed Caja',
          type: AccountType.ASSET,
          organization: { id: 'org-agro', name: 'AgroRed', code: 'AGRORED' },
        },
        {
          id: 'acc-rev',
          code: 'AGRORED_REVENUE',
          name: 'AgroRed Ingresos',
          type: AccountType.REVENUE,
          organization: { id: 'org-agro', name: 'AgroRed', code: 'AGRORED' },
        },
      ]);

      mockPrisma.ledgerEntry.findMany
        // For cash account: 100 debit
        .mockResolvedValueOnce([
          { direction: EntryDirection.DEBIT, amount: new Decimal('100.00') },
        ])
        // For revenue account: 100 credit
        .mockResolvedValueOnce([
          { direction: EntryDirection.CREDIT, amount: new Decimal('100.00') },
        ])
        // For student accounts aggregate: 0
        .mockResolvedValueOnce([]);

      const report = await service.getTrialBalance();

      expect(report.isBalanced).toBe(true);
      expect(report.totals.grandTotalDebits).toBe('100.00');
      expect(report.totals.grandTotalCredits).toBe('100.00');
      expect(report.totals.difference).toBe('0.00');
    });
  });

  describe('getIncomeStatement (P&L §28 PRD v1.0)', () => {
    it('should calculate Gross Profit and Net Income correctly for an organization', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-agro',
        name: 'AgroRed',
        code: 'AGRORED',
      });

      mockPrisma.ledgerAccount.findMany.mockResolvedValue([
        {
          id: 'acc-rev',
          code: 'AGRORED_REVENUE',
          name: 'Ingresos por Ventas',
          type: AccountType.REVENUE,
        },
        {
          id: 'acc-cogs',
          code: 'AGRORED_COGS',
          name: 'Costo de Ventas',
          type: AccountType.EXPENSE,
        },
        {
          id: 'acc-exp',
          code: 'AGRORED_OPERATING_EXPENSE',
          name: 'Gastos Operativos',
          type: AccountType.EXPENSE,
        },
      ]);

      mockPrisma.ledgerEntry.findMany
        // Revenue: 1000 credit
        .mockResolvedValueOnce([
          { direction: EntryDirection.CREDIT, amount: new Decimal('1000.00') },
        ])
        // COGS: 400 debit
        .mockResolvedValueOnce([
          { direction: EntryDirection.DEBIT, amount: new Decimal('400.00') },
        ])
        // Operating Expense: 150 debit
        .mockResolvedValueOnce([
          { direction: EntryDirection.DEBIT, amount: new Decimal('150.00') },
        ]);

      const res = await service.getIncomeStatement('org-agro');

      // Gross profit = 1000 - 400 = 600
      // Net income = 600 - 150 = 450
      expect(res.summary.totalRevenue).toBe('1000.00');
      expect(res.summary.totalCogs).toBe('400.00');
      expect(res.summary.grossProfit).toBe('600.00');
      expect(res.summary.grossMarginPercentage).toBe(60);
      expect(res.summary.totalOperatingExpenses).toBe('150.00');
      expect(res.summary.netIncome).toBe('450.00');
      expect(res.summary.netMarginPercentage).toBe(45);
    });
  });

  describe('getBalanceSheet (§28 PRD v1.0)', () => {
    it('should satisfy Assets == Liabilities + Equity (including Retained Earnings)', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-agro',
        name: 'AgroRed',
        code: 'AGRORED',
      });

      mockPrisma.ledgerAccount.findMany.mockResolvedValue([
        {
          id: 'acc-cash',
          code: 'AGRORED_CASH_VAULT',
          name: 'Caja',
          type: AccountType.ASSET,
        },
        {
          id: 'acc-inv',
          code: 'AGRORED_INVENTORY_ASSET',
          name: 'Inventario',
          type: AccountType.ASSET,
        },
        {
          id: 'acc-ap',
          code: 'AGRORED_ACCOUNTS_PAYABLE',
          name: 'Cuentas por Pagar',
          type: AccountType.LIABILITY,
        },
        {
          id: 'acc-rev',
          code: 'AGRORED_REVENUE',
          name: 'Ingresos',
          type: AccountType.REVENUE,
        },
      ]);

      mockPrisma.ledgerEntry.findMany
        // Cash: 500 debit
        .mockResolvedValueOnce([
          { direction: EntryDirection.DEBIT, amount: new Decimal('500.00') },
        ])
        // Inventory: 300 debit
        .mockResolvedValueOnce([
          { direction: EntryDirection.DEBIT, amount: new Decimal('300.00') },
        ])
        // Accounts Payable: 200 credit
        .mockResolvedValueOnce([
          { direction: EntryDirection.CREDIT, amount: new Decimal('200.00') },
        ])
        // Revenue (Retained Earnings): 600 credit
        .mockResolvedValueOnce([
          { direction: EntryDirection.CREDIT, amount: new Decimal('600.00') },
        ]);

      const res = await service.getBalanceSheet('org-agro');

      // Total Assets: 500 + 300 = 800
      // Total Liabilities: 200
      // Retained Earnings: 600
      // Total Liabilities + Equity: 200 + 600 = 800
      expect(res.assets.totalAssets).toBe('800.00');
      expect(res.liabilities.totalLiabilities).toBe('200.00');
      expect(res.equity.retainedEarnings).toBe('600.00');
      expect(res.totalLiabilitiesAndEquity).toBe('800.00');
      expect(res.isBalanced).toBe(true);
    });
  });

  describe('getInstitutionalOverview (§7.1, §7.2 PRD v1.0)', () => {
    it('should aggregate student savings custody and PYME performances for Surcos Saving authorities', async () => {
      mockPrisma.organization.findMany.mockResolvedValue([
        { id: 'org-saving', code: 'SAVING', name: 'Surcos Saving' },
        { id: 'org-agro', code: 'AGRORED', name: 'AgroRed' },
      ]);

      mockPrisma.ledgerEntry.findMany.mockResolvedValue([
        { direction: EntryDirection.CREDIT, amount: new Decimal('2000.00') }, // Deposits
        { direction: EntryDirection.DEBIT, amount: new Decimal('500.00') }, // Expenses
      ]);
      mockPrisma.studentAccount.count.mockResolvedValue(45);

      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-agro',
        name: 'AgroRed',
        code: 'AGRORED',
      });
      mockPrisma.ledgerAccount.findMany.mockResolvedValue([]);
      mockLedgerService.getLedgerAccountBalance.mockResolvedValue(new Decimal('1500.00'));

      const res = await service.getInstitutionalOverview();

      expect(res.surcosSaving.totalStudentAccounts).toBe(45);
      expect(res.surcosSaving.totalStudentSavingsInCustody).toBe('1500.00');
      expect(res.surcosSaving.totalGrossDeposits).toBe('2000.00');
      expect(res.surcosSaving.totalStudentOutflows).toBe('500.00');
    });
  });
});
