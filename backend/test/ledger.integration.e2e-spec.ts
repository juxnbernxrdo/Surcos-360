/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { LedgerService } from '../src/ledger/ledger.service';
import {
  TransactionType,
  EntryDirection,
  Prisma,
} from '@prisma/client';

const Decimal = Prisma.Decimal;

/**
 * Integration tests against a REAL PostgreSQL (docker postgres:17).
 * Run with: DATABASE_URL=postgresql://postgres:postgres@localhost:54329/s360_test npm run test:e2e
 * Requires migrations applied (`npx prisma migrate deploy`).
 */
describe('LedgerEngine (integration, real postgres)', () => {
  let prisma: PrismaService;
  let ledger: LedgerService;

  let orgId: string;
  let vaultId: string;
  let revenueId: string;
  let studentAccountId: string;

  const unique = Date.now();

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService, LedgerService],
    }).compile();

    prisma = module.get(PrismaService);
    ledger = module.get(LedgerService);
    await prisma.$connect();

    const org = await prisma.organization.create({
      data: { code: `INTG${unique % 100000}`, name: 'Integración Org' },
    });
    orgId = org.id;
    await ledger.ensureOrganizationAccounts(orgId, org.code, 'Integración Org');

    const vault = await prisma.ledgerAccount.findUniqueOrThrow({
      where: {
        organizationId_code: { organizationId: orgId, code: `${org.code}_CASH_VAULT` },
      },
    });
    vaultId = vault.id;

    const revenue = await prisma.ledgerAccount.findUniqueOrThrow({
      where: {
        organizationId_code: { organizationId: orgId, code: `${org.code}_REVENUE` },
      },
    });
    revenueId = revenue.id;

    const student = await prisma.institutionalPerson.create({
      data: {
        firstName: 'Integración',
        lastName: 'Ledger',
        email: `integ_${unique}@test.edu.ec`,
        institutionalCode: `INT${unique}`,
      },
    });

    const account = await prisma.studentAccount.create({
      data: {
        institutionalPersonId: student.id,
        accountNumber: `ACC${unique}`,
      },
    });
    studentAccountId = account.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "Transaction" CASCADE`,
    ).catch(() => {});
    await prisma.studentAccount.delete({ where: { id: studentAccountId } }).catch(() => {});
    await prisma.$executeRawUnsafe(
      `DELETE FROM "Organization" WHERE id = '${orgId}'`,
    ).catch(() => {});
    await prisma.$disconnect();
  });

  it('posts a balanced double-entry deposit and derives the balance', async () => {
    const tx = await ledger.depositToStudentAccount(
      studentAccountId,
      { amount: '50.00', description: 'Depósito integración' },
      'actor-1',
    );

    expect(tx.entries).toHaveLength(2);

    const { debit, credit } = tx.entries.reduce(
      (acc, e) => {
        if (e.direction === EntryDirection.DEBIT) acc.debit = acc.debit.add(e.amount);
        else acc.credit = acc.credit.add(e.amount);
        return acc;
      },
      { debit: new Decimal(0), credit: new Decimal(0) },
    );

    expect(debit.toString()).toBe(credit.toString());
    expect(tx.type).toBe(TransactionType.DEPOSIT);
  });

  it('rejects an unbalanced double-entry input and rolls back', async () => {
    await expect(
      ledger.createTransaction({
        type: TransactionType.DEPOSIT,
        description: 'Input desbalanceado',
        organizationId: orgId,
        actorId: 'actor-1',
        entries: [
          { ledgerAccountId: vaultId, direction: EntryDirection.DEBIT, amount: '10.00' },
          { ledgerAccountId: revenueId, direction: EntryDirection.CREDIT, amount: '9.00' },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a withdrawal exceeding the available balance', async () => {
    await ledger.depositToStudentAccount(
      studentAccountId,
      { amount: '10.00', description: 'Fondo para prueba de saldo' },
      'actor-1',
    );

    await expect(
      ledger.withdrawFromStudentAccount(
        studentAccountId,
        { amount: '999999.00', description: 'Retiro inválido' },
        'actor-2',
      ),
    ).rejects.toThrow(ConflictException);

    const balance = await ledger.getStudentAccountBalance(studentAccountId);
    expect(balance.lessThan('999999')).toBe(true);
  });

  it('serializes concurrent withdrawals via row lock (no double spend)', async () => {
    // Normalizar el saldo exactamente a 20.00 para que solo UNO de los retiros
    // concurrentes pueda completarse.
    const before = await ledger.getStudentAccountBalance(studentAccountId);
    const delta = new Decimal('20.00').sub(before);
    if (delta.greaterThan(0)) {
      await ledger.depositToStudentAccount(
        studentAccountId,
        { amount: delta.toString(), description: 'Ajuste a saldo 20.00' },
        'actor-1',
      );
    } else if (delta.lessThan(0)) {
      await ledger.withdrawFromStudentAccount(
        studentAccountId,
        { amount: delta.negated().toString(), description: 'Ajuste a saldo 20.00' },
        'actor-1',
      );
    }
    const normalized = await ledger.getStudentAccountBalance(studentAccountId);
    expect(normalized.toString()).toBe('20');

    const results = await Promise.allSettled([
      ledger.withdrawFromStudentAccount(
        studentAccountId,
        { amount: '20.00', description: 'Retiro concurrente A' },
        'actor-a',
      ),
      ledger.withdrawFromStudentAccount(
        studentAccountId,
        { amount: '20.00', description: 'Retiro concurrente B' },
        'actor-b',
      ),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const after = await ledger.getStudentAccountBalance(studentAccountId);
    expect(after.toString()).toBe('0');
  });

  it('dedupes concurrent transactions sharing the same idempotencyKey (advisory lock)', async () => {
    const key = `dup-${unique}`;
    const input = {
      type: TransactionType.DEPOSIT,
      description: 'Operación idempotente',
      organizationId: orgId,
      actorId: 'actor-1',
      idempotencyKey: key,
      entries: [
        { ledgerAccountId: vaultId, direction: EntryDirection.DEBIT, amount: '5.00' },
        { ledgerAccountId: revenueId, direction: EntryDirection.CREDIT, amount: '5.00' },
      ],
    };

    const [r1, r2] = await Promise.allSettled([
      ledger.createTransaction(input),
      ledger.createTransaction(input),
    ]);

    expect(r1.status).toBe('fulfilled');
    expect(r2.status).toBe('fulfilled');
    if (r1.status === 'fulfilled' && r2.status === 'fulfilled') {
      expect(r1.value.id).toBe(r2.value.id);
    }

    const count = await prisma.transaction.count({
      where: { idempotencyKey: key },
    });
    expect(count).toBe(1);
  });

  it('reverses a transaction restoring the prior balance', async () => {
    const before = await ledger.getStudentAccountBalance(studentAccountId);

    const dep = await ledger.depositToStudentAccount(
      studentAccountId,
      { amount: '25.00', description: 'Para reversión' },
      'actor-1',
    );

    const reversal = await ledger.reverseTransaction(
      dep.id,
      { reason: 'Reversión de prueba' },
      'actor-1',
    );
    expect(reversal.type).toBe(TransactionType.REVERSAL);

    const after = await ledger.getStudentAccountBalance(studentAccountId);
    expect(after.equals(before)).toBe(true);

    await expect(
      ledger.reverseTransaction(dep.id, { reason: 'Segunda reversión' }, 'actor-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('enforces append-only immutability at the DB level', async () => {
    const tx = await ledger.depositToStudentAccount(
      studentAccountId,
      { amount: '3.00', description: 'Para inmutabilidad' },
      'actor-1',
    );

    await expect(
      prisma.transaction.update({
        where: { id: tx.id },
        data: { description: 'modificada' },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.transaction.delete({ where: { id: tx.id } }),
    ).rejects.toThrow();
  });

  it('derives the batch balance across multiple ledger accounts', async () => {
    const accounts = await prisma.ledgerAccount.findMany({
      where: { organizationId: orgId },
    });
    const balances = await ledger.getLedgerAccountBalances(
      accounts.map((a) => a.id),
    );
    expect(balances.size).toBe(accounts.length);
  });

  it('throws NotFound for an unknown student account', async () => {
    await expect(
      ledger.lockStudentAccount('00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow(NotFoundException);
  });
});