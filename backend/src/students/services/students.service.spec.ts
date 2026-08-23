/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { StudentsService } from './students.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../../ledger/ledger.service';
import { TokensService } from '../../auth/services/tokens.service';
import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  UserType,
  TokenType,
  InstitutionStatus,
  Prisma,
  TransactionType,
  EntryDirection,
} from '@prisma/client';

const Decimal = Prisma.Decimal;

describe('StudentsService', () => {
  let service: StudentsService;
  let prisma: PrismaService;
  let ledgerService: LedgerService;
  let tokensService: TokensService;

  const mockPrisma = {
    institutionalPerson: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    studentProfile: {
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    customer: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    studentAccount: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    ledgerAccount: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
    },
    ledgerEntry: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    registrationToken: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  const mockLedgerService = {
    getStudentAccountBalance: jest.fn(),
    getStudentAccountBalances: jest.fn(),
    createTransaction: jest.fn(),
    getOrganizationAccount: jest.fn().mockResolvedValue({ id: 'vault-1' }),
  };

  const mockTokensService = {
    createToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LedgerService, useValue: mockLedgerService },
        { provide: TokensService, useValue: mockTokensService },
      ],
    }).compile();

    service = module.get<StudentsService>(StudentsService);
    prisma = module.get<PrismaService>(PrismaService);
    ledgerService = module.get<LedgerService>(LedgerService);
    tokensService = module.get<TokensService>(TokensService);

    jest.clearAllMocks();
  });

  describe('createStudent', () => {
    it('should create student with initial balance, double-entry transaction, customer profile, and registration token', async () => {
      mockPrisma.institutionalPerson.findUnique.mockResolvedValue(null);
      mockPrisma.institutionalPerson.create.mockResolvedValue({
        id: 'person-1',
        institutionId: 'default-institution',
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan@test.com',
        institutionalCode: 'STU001',
        userType: UserType.STUDENT,
        status: InstitutionStatus.ACTIVE,
      });
      mockPrisma.studentProfile.create.mockResolvedValue({
        id: 'rec-1',
        course: '3ro BGU',
        tutor: 'Prof. Gomez',
      });
      mockPrisma.customer.create.mockResolvedValue({ id: 'cust-1' });
      mockPrisma.studentAccount.create.mockResolvedValue({
        id: 'acc-1',
        accountNumber: 'ACC-STU-123456-7890',
      });
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-saving',
      });
      mockPrisma.ledgerAccount.findUnique.mockResolvedValue({ id: 'vault-1' });
      mockPrisma.transaction.create.mockResolvedValue({ id: 'tx-init' });
      // Mock the ledgerService.getOrganizationAccount call
      mockPrisma.ledgerAccount.findUnique.mockResolvedValue({ id: 'vault-1' });
      // Mock the ledgerService.createTransaction call
      mockLedgerService.createTransaction.mockResolvedValue({
        id: 'tx-init',
        // We don't need to mock the full transaction object, just the id for the result
      });
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-1' });

      mockTokensService.createToken.mockResolvedValue({
        plaintextToken: 'st_tok_random123',
        tokenRecord: { id: 'tok-rec-1' },
      });

      const result = await service.createStudent(
        {
          firstName: 'Juan',
          lastName: 'Pérez',
          email: 'juan@test.com',
          institutionalCode: 'STU001',
          course: '3ro BGU',
          tutor: 'Prof. Gomez',
          initialBalance: 100,
        },
        'admin-actor-id',
      );

      // Expect that the ledgerService.createTransaction was called with the correct parameters
      const createTransactionCalls = mockLedgerService.createTransaction.mock.calls;
      expect(createTransactionCalls.length).toBeGreaterThan(0);
      const [firstArg, secondArg] = createTransactionCalls[0];
      expect(firstArg).toMatchObject({
        type: TransactionType.INITIAL_BALANCE,
        description: expect.stringContaining('Saldo inicial de ahorro para Juan Pérez'),
        referenceType: 'STUDENT_ACCOUNT',
        referenceId: 'acc-1',
        organizationId: 'org-saving',
        actorId: 'admin-actor-id',
        entries: [
          {
            ledgerAccountId: 'vault-1',
            direction: EntryDirection.DEBIT,
            amount: expect.any(Object), // Decimal object
          },
          {
            studentAccountId: 'acc-1',
            direction: EntryDirection.CREDIT,
            amount: expect.any(Object), // Decimal object
          },
        ],
      });
      // Second arg should be the Prisma transaction client (mockPrisma)
      expect(secondArg).toBeDefined();

      // Expect that the direct prisma calls for transaction and ledgerEntry are not made
      expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
      expect(mockPrisma.ledgerEntry.create).not.toHaveBeenCalled();

      expect(mockPrisma.institutionalPerson.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'juan@test.com',
            institutionalCode: 'STU001',
            userType: UserType.STUDENT,
          }),
        }),
      );
      expect(mockPrisma.studentAccount.create).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'STUDENT_CREATED',
            entity: 'InstitutionalPerson',
          }),
        }),
      );
      expect(result.registrationToken).toBe('st_tok_random123');
      expect(result.initialBalance).toBe('100');
    });

    it('should create student without transaction when initialBalance is 0', async () => {
      mockPrisma.institutionalPerson.findUnique.mockResolvedValue(null);
      mockPrisma.institutionalPerson.create.mockResolvedValue({
        id: 'person-2',
        email: 'maria@test.com',
        institutionalCode: 'STU002',
        userType: UserType.STUDENT,
      });
      mockPrisma.studentProfile.create.mockResolvedValue({ id: 'rec-2' });
      mockPrisma.customer.create.mockResolvedValue({ id: 'cust-2' });
      mockPrisma.studentAccount.create.mockResolvedValue({
        id: 'acc-2',
        accountNumber: 'ACC-STU-0002',
      });
      mockTokensService.createToken.mockResolvedValue({
        plaintextToken: 'tok-maria',
        tokenRecord: { id: 'rec-tok-2' },
      });

      const result = await service.createStudent(
        {
          firstName: 'Maria',
          lastName: 'Lopez',
          email: 'maria@test.com',
          institutionalCode: 'STU002',
          course: '1ro BGU',
          initialBalance: 0,
        },
        'admin-actor',
      );

      expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
      expect(mockPrisma.ledgerEntry.create).not.toHaveBeenCalled();
      expect(result.initialBalance).toBe('0');
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrisma.institutionalPerson.findUnique.mockResolvedValueOnce({
        id: 'existing-id',
        email: 'duplicate@test.com',
      });

      await expect(
        service.createStudent({
          firstName: 'Carlos',
          lastName: 'Diaz',
          email: 'duplicate@test.com',
          institutionalCode: 'STU003',
          course: '2do BGU',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if institutionalCode already exists', async () => {
      mockPrisma.institutionalPerson.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'existing-id-2',
          institutionalCode: 'STU_DUP',
        });

      await expect(
        service.createStudent({
          firstName: 'Carlos',
          lastName: 'Diaz',
          email: 'carlos@test.com',
          institutionalCode: 'STU_DUP',
          course: '2do BGU',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if initialBalance is negative', async () => {
      mockPrisma.institutionalPerson.findUnique.mockResolvedValue(null);

      await expect(
        service.createStudent({
          firstName: 'Carlos',
          lastName: 'Diaz',
          email: 'carlos@test.com',
          institutionalCode: 'STU005',
          course: '2do BGU',
          initialBalance: -50,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated list of students with enriched live balances', async () => {
      mockPrisma.institutionalPerson.count.mockResolvedValue(1);
      mockPrisma.institutionalPerson.findMany.mockResolvedValue([
        {
          id: 'p-1',
          firstName: 'Ana',
          lastName: 'Vargas',
          email: 'ana@test.com',
          institutionalCode: 'STU010',
          institutionId: 'inst-1',
          status: InstitutionStatus.ACTIVE,
          studentProfile: { course: '3ro BGU', tutor: 'Prof. X' },
          studentAccount: { id: 'acc-1', accountNumber: 'ACC-010' },
          userId: 'uid-1',
          createdAt: new Date(),
        },
      ]);
      const balanceMap = new Map<string, Decimal>();
      balanceMap.set('acc-1', new Decimal(45.5));
      mockLedgerService.getStudentAccountBalances.mockResolvedValue(balanceMap);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].currentBalance).toBe('45.50');
      expect(result.data[0].course).toBe('3ro BGU');
      expect(result.data[0].hasAuthAccount).toBe(true);
    });
  });

  describe('findById', () => {
    it('should return full student details with balances and representative info', async () => {
      mockPrisma.institutionalPerson.findUnique.mockResolvedValue({
        id: 'p-1',
        userType: UserType.STUDENT,
        firstName: 'Ana',
        lastName: 'Vargas',
        email: 'ana@test.com',
        institutionalCode: 'STU010',
        institutionId: 'inst-1',
        status: InstitutionStatus.ACTIVE,
        userId: 'uid-1',
        studentProfile: {
          course: '3ro BGU',
          tutor: 'Prof. X',
          academicYear: '2026-2027',
          representative: {
            id: 'rep-1',
            phoneNumber: '0999999999',
            identificationNumber: '1712345678',
            institutionalPerson: {
              id: 'rep-person-1',
              firstName: 'Roberto',
              lastName: 'Vargas',
              email: 'roberto@gmail.com',
            },
          },
        },
        studentAccount: { id: 'acc-1', accountNumber: 'ACC-010' },
        customers: [{ id: 'cust-1' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockLedgerService.getStudentAccountBalance.mockResolvedValue(
        new Decimal(75),
      );

      const result = await service.findById('p-1');

      expect(result.id).toBe('p-1');
      expect(result.currentBalance).toBe('75.00');
      expect(result.studentProfile.representative?.fullName).toBe('Roberto Vargas');
    });

    it('should throw NotFoundException if student does not exist', async () => {
      mockPrisma.institutionalPerson.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStudent', () => {
    it('should update student details and record audit log', async () => {
      mockPrisma.institutionalPerson.findUnique.mockResolvedValue({
        id: 'p-1',
        userType: UserType.STUDENT,
        firstName: 'Juan',
        lastName: 'Pérez',
        status: InstitutionStatus.ACTIVE,
        studentProfile: { course: '2do BGU', tutor: 'Old Tutor' },
        studentAccount: { id: 'acc-1' },
      });
      mockPrisma.institutionalPerson.update.mockResolvedValue({ id: 'p-1' });
      mockPrisma.studentProfile.upsert.mockResolvedValue({ id: 'rec-1' });
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-1' });
      mockLedgerService.getStudentAccountBalance.mockResolvedValue(
        new Decimal(0),
      );

      await service.updateStudent(
        'p-1',
        { firstName: 'Juan Carlos', course: '3ro BGU', tutor: 'New Tutor' },
        'admin-actor',
      );

      expect(mockPrisma.institutionalPerson.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p-1' },
          data: expect.objectContaining({ firstName: 'Juan Carlos' }),
        }),
      );
      expect(mockPrisma.studentProfile.upsert).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'STUDENT_UPDATED',
          }),
        }),
      );
    });
  });

  describe('updateAcademicData', () => {
    it('should update course and tutor with ACADEMIC_DATA_UPDATED audit log', async () => {
      mockPrisma.institutionalPerson.findUnique.mockResolvedValue({
        id: 'p-1',
        userType: UserType.STUDENT,
        studentProfile: { id: 'sp-1', course: '2do BGU', tutor: 'Tutor 1' },
        studentAccount: { id: 'acc-1' },
      });
      mockPrisma.studentProfile.upsert.mockResolvedValue({ id: 'sp-1' });
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-1' });
      mockLedgerService.getStudentAccountBalance.mockResolvedValue(new Decimal(50));

      await service.updateAcademicData(
        'p-1',
        { course: '3ro BGU "B"', tutor: 'Tutor 2', academicYear: '2026-2027' },
        'admin-actor',
      );

      expect(mockPrisma.studentProfile.upsert).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ACADEMIC_DATA_UPDATED',
          }),
        }),
      );
    });
  });

  describe('updateStatus', () => {
    it('should update student status and record audit log', async () => {
      mockPrisma.institutionalPerson.findUnique.mockResolvedValue({
        id: 'p-1',
        userType: UserType.STUDENT,
        status: InstitutionStatus.ACTIVE,
      });
      mockPrisma.institutionalPerson.update.mockResolvedValue({
        id: 'p-1',
        status: InstitutionStatus.SUSPENDED,
      });
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-1' });

      const result = await service.updateStatus(
        'p-1',
        {
          status: InstitutionStatus.SUSPENDED,
          reason: 'Disciplinary suspension',
        },
        'admin-actor',
      );

      expect(mockPrisma.institutionalPerson.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p-1' },
          data: { status: InstitutionStatus.SUSPENDED },
        }),
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'STUDENT_STATUS_UPDATED',
          }),
        }),
      );
      expect(result.status).toBe(InstitutionStatus.SUSPENDED);
    });
  });

  describe('lookupStudent', () => {
    it('should lookup active student by institutional code and return POS details', async () => {
      mockPrisma.institutionalPerson.findFirst.mockResolvedValue({
        id: 'p-1',
        firstName: 'Mateo',
        lastName: 'Silva',
        email: 'mateo@colegiosurcos.edu.ec',
        institutionalCode: 'STU100',
        studentProfile: { course: '3ro BGU' },
        studentAccount: { id: 'acc-1', accountNumber: 'ACC-STU-100' },
        customers: [{ id: 'cust-100' }],
      });
      mockLedgerService.getStudentAccountBalance.mockResolvedValue(
        new Decimal(12.5),
      );

      const result = await service.lookupStudent({ code: 'STU100' });

      expect(result.fullName).toBe('Mateo Silva');
      expect(result.currentBalance).toBe('12.50');
      expect(result.customerId).toBe('cust-100');
    });

    it('should throw BadRequestException if neither code nor email is provided', async () => {
      await expect(service.lookupStudent({})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if active student is not found', async () => {
      mockPrisma.institutionalPerson.findFirst.mockResolvedValue(null);

      await expect(service.lookupStudent({ code: 'UNKNOWN' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
