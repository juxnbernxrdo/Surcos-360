/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { LedgerController } from './ledger.controller';
import { LedgerService } from '../ledger.service';
import { FinancialAccountsService } from '../services/financial-accounts.service';
import { TransactionType, EntryDirection, AccountType, UserType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

describe('LedgerController', () => {
  let controller: LedgerController;
  let ledgerService: LedgerService;
  let accountsService: FinancialAccountsService;

  const mockReq = {
    user: {
      id: 'actor-1',
      institutionalPerson: { id: 'actor-1', userType: UserType.AUTHORITY },
      memberships: [],
    },
  };

  const mockLedgerService = {
    createTransaction: jest.fn(),
    reverseTransaction: jest.fn(),
    depositToStudentAccount: jest.fn(),
    withdrawFromStudentAccount: jest.fn(),
    findTransactions: jest.fn(),
    findTransactionById: jest.fn(),
  };

  const mockAccountsService = {
    getOrganizationAccounts: jest.fn(),
    createLedgerAccount: jest.fn(),
    getAccountStatement: jest.fn(),
  };

  const mockPrismaService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LedgerController],
      providers: [
        { provide: LedgerService, useValue: mockLedgerService },
        { provide: FinancialAccountsService, useValue: mockAccountsService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    controller = module.get<LedgerController>(LedgerController);
    ledgerService = module.get<LedgerService>(LedgerService);
    accountsService = module.get<FinancialAccountsService>(FinancialAccountsService);
    jest.clearAllMocks();
  });

  it('should create an arbitrary double-entry transaction', async () => {
    mockLedgerService.createTransaction.mockResolvedValue({ id: 'tx-1' });
    const dto = {
      type: TransactionType.DEPOSIT,
      description: 'Test tx',
      entries: [
        { ledgerAccountId: 'acc-1', direction: EntryDirection.DEBIT, amount: 50 },
        { ledgerAccountId: 'acc-2', direction: EntryDirection.CREDIT, amount: 50 },
      ],
    };

    const res = await controller.createTransaction(dto, 'actor-1');
    expect(res).toEqual({ id: 'tx-1' });
    expect(mockLedgerService.createTransaction).toHaveBeenCalledWith({
      ...dto,
      actorId: 'actor-1',
    });
  });

  it('should reverse a transaction', async () => {
    mockLedgerService.reverseTransaction.mockResolvedValue({ id: 'rev-tx-1' });
    const res = await controller.reverseTransaction(
      'tx-1',
      { reason: 'Anulación' },
      'actor-1',
    );
    expect(res).toEqual({ id: 'rev-tx-1' });
    expect(mockLedgerService.reverseTransaction).toHaveBeenCalledWith(
      'tx-1',
      { reason: 'Anulación' },
      'actor-1',
    );
  });

  it('should deposit funds into student account', async () => {
    mockLedgerService.depositToStudentAccount.mockResolvedValue({ id: 'tx-dep' });
    const res = await controller.depositToStudentAccount(
      'stu-1',
      { amount: 100, description: 'Depósito mensual' },
      'admin-1',
    );
    expect(res).toEqual({ id: 'tx-dep' });
  });

  it('should withdraw funds from student account', async () => {
    mockLedgerService.withdrawFromStudentAccount.mockResolvedValue({ id: 'tx-with' });
    const res = await controller.withdrawFromStudentAccount(
      'stu-1',
      { amount: 50, description: 'Retiro autorizado' },
      'admin-1',
    );
    expect(res).toEqual({ id: 'tx-with' });
  });

  it('should list transactions with query parameters', async () => {
    mockLedgerService.findTransactions.mockResolvedValue({ data: [], total: 0 });
    const res = await controller.findTransactions({ page: 1, limit: 10 }, mockReq);
    expect(res).toEqual({ data: [], total: 0 });
  });

  it('should retrieve single transaction by ID', async () => {
    mockLedgerService.findTransactionById.mockResolvedValue({ id: 'tx-123' });
    const res = await controller.findTransactionById('tx-123', mockReq);
    expect(res).toEqual({ id: 'tx-123' });
  });

  it('should retrieve organization accounts with balances', async () => {
    mockAccountsService.getOrganizationAccounts.mockResolvedValue({ accounts: [] });
    const res = await controller.getOrganizationAccounts('org-1', mockReq);
    expect(res).toEqual({ accounts: [] });
  });

  it('should create a custom ledger account', async () => {
    mockAccountsService.createLedgerAccount.mockResolvedValue({ id: 'acc-new' });
    const res = await controller.createLedgerAccount('org-1', {
      code: 'CUSTOM_ACC',
      name: 'Custom',
      type: AccountType.EXPENSE,
    }, mockReq);
    expect(res).toEqual({ id: 'acc-new' });
  });

  it('should retrieve account statement', async () => {
    mockAccountsService.getAccountStatement.mockResolvedValue({ movements: [] });
    const res = await controller.getAccountStatement('acc-1', '2026-01-01', '2026-12-31', mockReq);
    expect(res).toEqual({ movements: [] });
  });

  it('scopes ledger reads to the TEACHER active memberships', async () => {
    mockLedgerService.findTransactions.mockResolvedValue({ data: [], total: 0 });
    const teacherReq = {
      user: {
        id: 'teacher-1',
        institutionalPerson: { id: 'teacher-1', userType: UserType.TEACHER },
        memberships: [
          { organizationId: 'org-1', status: 'ACTIVE' },
          { organizationId: 'org-2', status: 'PENDING' },
          { organizationId: 'org-3' },
        ],
      },
    };
    await controller.findTransactions({ page: 1, limit: 10 }, teacherReq);
    expect(mockLedgerService.findTransactions).toHaveBeenCalledWith(
      { page: 1, limit: 10 },
      undefined,
      ['org-1', 'org-3'],
    );
  });

  it('forbids a TEACHER with no active memberships (Tenant Context)', async () => {
    const isolatedReq = {
      user: {
        id: 'teacher-2',
        institutionalPerson: { id: 'teacher-2', userType: UserType.TEACHER },
        memberships: [],
      },
    };
    await expect(
      controller.findTransactions({ page: 1, limit: 10 }, isolatedReq),
    ).rejects.toThrow('no pertenece a ninguna organización');
  });

  it('lets AUTHORITY pass an unscoped (platform-wide) query', async () => {
    mockAccountsService.getOrganizationAccounts.mockResolvedValue({ accounts: [] });
    await controller.getOrganizationAccounts('org-any', mockReq);
    expect(mockAccountsService.getOrganizationAccounts).toHaveBeenCalledWith(
      'org-any',
      undefined,
    );
  });
});
