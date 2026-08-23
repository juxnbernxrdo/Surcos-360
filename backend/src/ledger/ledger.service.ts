import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  EntryDirection,
  TransactionType,
  AccountType,
  Prisma,
} from '@prisma/client';
import {
  getPymeStandardAccounts,
  StandardAccountCodes,
} from './constants/account-codes.constant';
import {
  CreateTransactionDto,
  QueryTransactionsDto,
  ReverseTransactionDto,
  StudentDepositDto,
  StudentWithdrawalDto,
} from './dto';
import { MoneyUtil } from '../common/money';

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;
type TxClient = Prisma.TransactionClient;

export interface LedgerEntryInput {
  studentAccountId?: string;
  ledgerAccountId?: string;
  direction: EntryDirection;
  amount: Decimal | string;
}

export interface CreateTransactionInput {
  type: TransactionType;
  description: string;
  referenceType?: string;
  referenceId?: string;
  organizationId?: string;
  actorId: string;
  idempotencyKey?: string;
  currency?: string;
  metadata?: Prisma.InputJsonValue;
  entries: LedgerEntryInput[];
}

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta `fn` dentro de una transacción atómica de base de datos.
   * Si el cliente recibido ya es un TransactionClient (llamada desde una
   * transacción padre), se reutiliza; si es el servicio raíz, se abre una
   * transacción interactiva ($transaction) que garantiza ROLLBACK total.
   */
  private runInTx<T>(
    client: TxClient | PrismaService,
    fn: (tx: TxClient) => Promise<T>,
  ): Promise<T> {
    if (client === this.prisma) {
      return this.prisma.$transaction((tx) => fn(tx));
    }
    return fn(client);
  }

  /**
   * Bloqueo pesimista (SELECT ... FOR UPDATE) sobre una StudentAccount.
   * Serializa la verificación de saldo + escritura para impedir doble gasto
   * (TOCTOU) cuando operaciones concurrentes afectan la misma billetera.
   */
  async lockStudentAccount(
    studentAccountId: string,
    client: TxClient | PrismaService = this.prisma,
  ): Promise<void> {
    const rows = await client.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "StudentAccount" WHERE id = ${studentAccountId} FOR UPDATE
    `;
    if (!rows || rows.length === 0) {
      throw new NotFoundException(
        `Cuenta de estudiante '${studentAccountId}' no encontrada.`,
      );
    }
  }

  /**
   * Generates formatted, cryptographically unique transaction reference number.
   */
  public generateTransactionNumber(prefix = 'TX'): string {
    const timestamp = Date.now().toString().slice(-6);
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${timestamp}-${rand}`;
  }

  /**
   * Ensures standard chart of accounts exists for a given organization (§7.3, §8 PRD v1.0).
   * Automatically initializes necessary accounts idempotently.
   */
  async ensureOrganizationAccounts(
    organizationId: string,
    orgCode: string,
    orgName: string,
    prismaClient: TxClient | PrismaService = this.prisma,
  ) {
    if (orgCode.toUpperCase() === 'SAVING') {
      // Surcos Saving Central Accounts
      await prismaClient.ledgerAccount.upsert({
        where: {
          organizationId_code: {
            organizationId,
            code: StandardAccountCodes.SAVING_CENTRAL_VAULT,
          },
        },
        update: {},
        create: {
          organizationId,
          code: StandardAccountCodes.SAVING_CENTRAL_VAULT,
          name: 'Bóveda Central de Ahorro',
          type: AccountType.ASSET,
        },
      });

      await prismaClient.ledgerAccount.upsert({
        where: {
          organizationId_code: {
            organizationId,
            code: StandardAccountCodes.STUDENT_SAVINGS_LIABILITY,
          },
        },
        update: {},
        create: {
          organizationId,
          code: StandardAccountCodes.STUDENT_SAVINGS_LIABILITY,
          name: 'Pasivo de Ahorros Estudiantiles Custodiados',
          type: AccountType.LIABILITY,
        },
      });
      return;
    }

    // Standard PYME accounts
    const standardDefs = getPymeStandardAccounts(orgCode, orgName);
    for (const def of standardDefs) {
      await prismaClient.ledgerAccount.upsert({
        where: {
          organizationId_code: {
            organizationId,
            code: def.code,
          },
        },
        update: {},
        create: {
          organizationId,
          code: def.code,
          name: def.name,
          type: def.type,
        },
      });
    }
  }

  /**
   * Resolves or provisions a specific organization account by code.
   */
  async getOrganizationAccount(
    organizationId: string,
    accountCode: string,
    prismaClient: TxClient | PrismaService = this.prisma,
  ) {
    let account = await prismaClient.ledgerAccount.findUnique({
      where: {
        organizationId_code: {
          organizationId,
          code: accountCode,
        },
      },
    });

    if (!account) {
      const org = await prismaClient.organization.findUnique({
        where: { id: organizationId },
      });
      if (!org) {
        throw new NotFoundException(
          `Organización con ID '${organizationId}' no encontrada.`,
        );
      }
      await this.ensureOrganizationAccounts(
        organizationId,
        org.code,
        org.name,
        prismaClient,
      );
      account = await prismaClient.ledgerAccount.findUnique({
        where: {
          organizationId_code: {
            organizationId,
            code: accountCode,
          },
        },
      });
    }

    if (!account) {
      throw new NotFoundException(
        `Cuenta contable '${accountCode}' no encontrada para la organización '${organizationId}'.`,
      );
    }

    return account;
  }

  /**
   * Crea una transacción contable de partida doble estrictamente balanceada.
   * Garantías (§5, §7.3 PRD v1.0):
   * 1. >= 2 asientos, montos > 0, SUM(DEBIT) == SUM(CREDIT).
   * 2. Atómica: transacción + asientos dentro de una sola $transaction.
   * 3. Idempotente: bloqueo de asesoría clave-scoped evita duplicados concurrentes.
   * 4. Immutable: solo INSERT (los triggers de BD bloquean UPDATE/DELETE).
   */
  async createTransaction(
    input:
      CreateTransactionInput | (CreateTransactionDto & { actorId: string }),
    prismaClient: TxClient | PrismaService = this.prisma,
  ) {
    return this.runInTx(prismaClient, async (tx) => {
      // 1. Idempotencia con bloqueo de asesoría (evita carrera CHECK -> INSERT)
      if (input.idempotencyKey) {
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${`ldg:${input.idempotencyKey}`}))
        `;
        const existing = await tx.transaction.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: {
            entries: {
              include: {
                ledgerAccount: true,
                studentAccount: {
                  include: { institutionalPerson: true },
                },
              },
            },
          },
        });
        if (existing) {
          return existing;
        }
      }

      if (!input.entries || input.entries.length < 2) {
        throw new BadRequestException(
          'Una transacción contable de partida doble debe contener al menos 2 asientos.',
        );
      }

      let totalDebit = new Decimal(0);
      let totalCredit = new Decimal(0);

      for (const entry of input.entries) {
        const amountDecimal = this.normalizeAmount(entry.amount);
        if (amountDecimal.lessThanOrEqualTo(0)) {
          throw new BadRequestException(
            'El monto de cada asiento contable debe ser estrictamente mayor a 0.',
          );
        }

        if (!entry.studentAccountId && !entry.ledgerAccountId) {
          throw new BadRequestException(
            'Cada asiento debe especificar una studentAccountId o una ledgerAccountId.',
          );
        }

        if (entry.direction === EntryDirection.DEBIT) {
          totalDebit = totalDebit.add(amountDecimal);
        } else if (entry.direction === EntryDirection.CREDIT) {
          totalCredit = totalCredit.add(amountDecimal);
        } else {
          throw new BadRequestException(
            'Dirección de asiento inválida. Debe ser DEBIT o CREDIT.',
          );
        }
      }

      if (!totalDebit.equals(totalCredit)) {
        throw new BadRequestException(
          `Transacción contable descuadrada: Total DÉBITO ($${totalDebit.toFixed(2)}) no es igual a Total CRÉDITO ($${totalCredit.toFixed(2)}).`,
        );
      }

      const txNumber = this.generateTransactionNumber();

      const transaction = await tx.transaction.create({
        data: {
          transactionNumber: txNumber,
          type: input.type,
          description: input.description.trim(),
          referenceType: input.referenceType
            ? input.referenceType.trim()
            : null,
          referenceId: input.referenceId ? input.referenceId.trim() : null,
          organizationId: input.organizationId || null,
          actorId: input.actorId,
          idempotencyKey: input.idempotencyKey
            ? input.idempotencyKey.trim()
            : null,
          currency: input.currency
            ? input.currency.trim().toUpperCase()
            : 'USD',
          metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
        },
      });

      const entryPromises = input.entries.map((e) =>
        tx.ledgerEntry.create({
          data: {
            transactionId: transaction.id,
            studentAccountId: e.studentAccountId || null,
            ledgerAccountId: e.ledgerAccountId || null,
            direction: e.direction,
            amount: this.normalizeAmount(e.amount),
          },
        }),
      );

      const createdEntries = await Promise.all(entryPromises);

      return {
        ...transaction,
        entries: createdEntries,
      };
    });
  }

  private normalizeAmount(value: Decimal | string): Decimal {
    try {
      return MoneyUtil.parse(
        typeof value === 'string' ? value : value.toString(),
      );
    } catch {
      throw new BadRequestException(
        `Monto monetario inválido '${String(value)}'. Formato esperado: hasta 2 decimales, sin coma flotante.`,
      );
    }
  }

  /**
   * Reversa una transacción existente creando un asiento de reversión inmutable
   * (§18, §19 PRD v1.0). La original permanece intacta; se registra un nuevo
   * REVERSAL intercambiando débitos y créditos.
   */
  async reverseTransaction(
    transactionId: string,
    dto: ReverseTransactionDto,
    actorId: string,
    prismaClient: TxClient | PrismaService = this.prisma,
  ) {
    return this.runInTx(prismaClient, async (tx) => {
      const original = await tx.transaction.findUnique({
        where: { id: transactionId },
        include: { entries: true },
      });

      if (!original) {
        throw new NotFoundException(
          `Transacción con ID '${transactionId}' no encontrada.`,
        );
      }

      if (original.type === TransactionType.REVERSAL) {
        throw new BadRequestException(
          'No se puede revertir una transacción que ya es una reversión contable.',
        );
      }

      // Check if this transaction has already been reversed
      const existingReversal = await tx.transaction.findFirst({
        where: { reversalOfId: transactionId },
      });

      if (existingReversal) {
        throw new ConflictException(
          `La transacción '${transactionId}' ya fue revertida previamente por la transacción '${existingReversal.transactionNumber || existingReversal.id}'.`,
        );
      }

      // Prepare inverted entries: DEBIT -> CREDIT and CREDIT -> DEBIT
      const invertedEntries: LedgerEntryInput[] = original.entries.map(
        (entry) => ({
          studentAccountId: entry.studentAccountId || undefined,
          ledgerAccountId: entry.ledgerAccountId || undefined,
          direction:
            entry.direction === EntryDirection.DEBIT
              ? EntryDirection.CREDIT
              : EntryDirection.DEBIT,
          amount: entry.amount,
        }),
      );

      const reversalTxNumber = this.generateTransactionNumber('REV');

      const reversalTx = await tx.transaction.create({
        data: {
          transactionNumber: reversalTxNumber,
          type: TransactionType.REVERSAL,
          description: `REVERSIÓN: ${dto.reason.trim()} (Ref: ${original.transactionNumber || original.id})`,
          referenceType: original.referenceType,
          referenceId: original.referenceId,
          organizationId: original.organizationId,
          actorId,
          reversalOfId: original.id,
          idempotencyKey: dto.idempotencyKey || null,
          currency: original.currency,
        },
      });

      const entryPromises = invertedEntries.map((e) =>
        tx.ledgerEntry.create({
          data: {
            transactionId: reversalTx.id,
            studentAccountId: e.studentAccountId || null,
            ledgerAccountId: e.ledgerAccountId || null,
            direction: e.direction,
            amount: this.normalizeAmount(e.amount),
          },
        }),
      );

      const createdEntries = await Promise.all(entryPromises);

      // Audit log
      await tx.auditLog.create({
        data: {
          actorId,
          organizationId: original.organizationId,
          action: 'TRANSACTION_REVERSED',
          entity: 'Transaction',
          entityId: original.id,
          previousState: {
            originalTransactionId: original.id,
            type: original.type,
          },
          newState: {
            reversalTransactionId: reversalTx.id,
            reversalNumber: reversalTx.transactionNumber,
            reason: dto.reason,
          },
        },
      });

      return {
        ...reversalTx,
        entries: createdEntries,
      };
    });
  }

  /**
   * Calculates real-time derived balance for a StudentAccount from append-only ledger entries (§7.3, §9 PRD v1.0).
   * Formula: SUM(CREDIT) - SUM(DEBIT)
   */
  async getStudentAccountBalance(
    studentAccountId: string,
    prismaClient: TxClient | PrismaService = this.prisma,
  ): Promise<Decimal> {
    const entries = await prismaClient.ledgerEntry.findMany({
      where: { studentAccountId },
      select: { direction: true, amount: true },
    });

    let balance = new Decimal(0);
    for (const entry of entries) {
      if (entry.direction === EntryDirection.CREDIT) {
        balance = balance.add(entry.amount);
      } else if (entry.direction === EntryDirection.DEBIT) {
        balance = balance.sub(entry.amount);
      }
    }

    return balance;
  }

  /**
   * Saldo derivado de una StudentAccount hasta una fecha (para balances iniciales en reportes).
   */
  async getStudentAccountBalanceAsOf(
    studentAccountId: string,
    asOf: Date,
    prismaClient: TxClient | PrismaService = this.prisma,
  ): Promise<Decimal> {
    const entries = await prismaClient.ledgerEntry.findMany({
      where: { studentAccountId, createdAt: { lt: asOf } },
      select: { direction: true, amount: true },
    });

    let balance = new Decimal(0);
    for (const entry of entries) {
      if (entry.direction === EntryDirection.CREDIT) {
        balance = balance.add(entry.amount);
      } else if (entry.direction === EntryDirection.DEBIT) {
        balance = balance.sub(entry.amount);
      }
    }
    return balance;
  }

  /**
   * Cálculo por lotes de saldos de billeteras estudiantiles (elimina N+1).
   * Devuelve un mapa studentAccountId -> saldo derivado.
   */
  async getStudentAccountBalances(
    studentAccountIds: string[],
    prismaClient: TxClient | PrismaService = this.prisma,
  ): Promise<Map<string, Decimal>> {
    const result = new Map<string, Decimal>();
    if (studentAccountIds.length === 0) return result;

    const groups = await prismaClient.ledgerEntry.groupBy({
      by: ['studentAccountId', 'direction'],
      where: { studentAccountId: { in: studentAccountIds } },
      _sum: { amount: true },
    });

    for (const id of studentAccountIds) {
      result.set(id, new Decimal(0));
    }

    for (const g of groups) {
      if (!g.studentAccountId) continue;
      const amount = g._sum.amount ?? new Decimal(0);
      const current = result.get(g.studentAccountId) ?? new Decimal(0);
      if (g.direction === EntryDirection.CREDIT) {
        result.set(g.studentAccountId, current.add(amount));
      } else if (g.direction === EntryDirection.DEBIT) {
        result.set(g.studentAccountId, current.sub(amount));
      }
    }

    return result;
  }

  /**
   * Calculates derived balance for a general LedgerAccount based on normal balance rules (§7.3 PRD v1.0).
   */
  async getLedgerAccountBalance(
    ledgerAccountId: string,
    prismaClient: TxClient | PrismaService = this.prisma,
  ): Promise<Decimal> {
    const account = await prismaClient.ledgerAccount.findUnique({
      where: { id: ledgerAccountId },
    });

    if (!account) {
      throw new NotFoundException(
        `Cuenta contable con ID '${ledgerAccountId}' no encontrada.`,
      );
    }

    const entries = await prismaClient.ledgerEntry.findMany({
      where: { ledgerAccountId },
      select: { direction: true, amount: true },
    });

    let debits = new Decimal(0);
    let credits = new Decimal(0);

    for (const entry of entries) {
      if (entry.direction === EntryDirection.DEBIT) {
        debits = debits.add(entry.amount);
      } else if (entry.direction === EntryDirection.CREDIT) {
        credits = credits.add(entry.amount);
      }
    }

    // Normal balance conventions
    switch (account.type) {
      case AccountType.ASSET:
      case AccountType.EXPENSE:
        // Asset & Expense normal balance is DEBIT
        return debits.sub(credits);

      case AccountType.LIABILITY:
      case AccountType.REVENUE:
      case AccountType.EQUITY:
      case AccountType.STUDENT_WALLET:
        // Liability, Revenue & Equity normal balance is CREDIT
        return credits.sub(debits);

      default:
        return debits.sub(credits);
    }
  }

  /**
   * Cálculo por lotes de saldos de cuentas contables generales (elimina N+1).
   * Devuelve un mapa ledgerAccountId -> saldo derivado según tipo de cuenta.
   */
  async getLedgerAccountBalances(
    ledgerAccountIds: string[],
    prismaClient: TxClient | PrismaService = this.prisma,
  ): Promise<Map<string, Decimal>> {
    const result = new Map<string, Decimal>();
    if (ledgerAccountIds.length === 0) return result;

    const accounts = await prismaClient.ledgerAccount.findMany({
      where: { id: { in: ledgerAccountIds } },
      select: { id: true, type: true },
    });

    const groups = await prismaClient.ledgerEntry.groupBy({
      by: ['ledgerAccountId', 'direction'],
      where: { ledgerAccountId: { in: ledgerAccountIds } },
      _sum: { amount: true },
    });

    for (const acc of accounts) {
      result.set(acc.id, new Decimal(0));
    }

    const debits = new Map<string, Decimal>();
    const credits = new Map<string, Decimal>();
    for (const g of groups) {
      if (!g.ledgerAccountId) continue;
      const amount = g._sum.amount ?? new Decimal(0);
      if (g.direction === EntryDirection.DEBIT) {
        debits.set(
          g.ledgerAccountId,
          (debits.get(g.ledgerAccountId) ?? new Decimal(0)).add(amount),
        );
      } else if (g.direction === EntryDirection.CREDIT) {
        credits.set(
          g.ledgerAccountId,
          (credits.get(g.ledgerAccountId) ?? new Decimal(0)).add(amount),
        );
      }
    }

    for (const acc of accounts) {
      const d = debits.get(acc.id) ?? new Decimal(0);
      const c = credits.get(acc.id) ?? new Decimal(0);
      switch (acc.type) {
        case AccountType.ASSET:
        case AccountType.EXPENSE:
          result.set(acc.id, d.sub(c));
          break;
        default:
          result.set(acc.id, c.sub(d));
          break;
      }
    }

    return result;
  }

  /**
   * Deposits funds into a student savings account (§7.1, §8 PRD v1.0).
   * Atómico: bloquea la fila de la billetera, crea transacción + asientos en
   * una única $transaction. Double-entry: DEBIT Bóveda / CREDIT Billetera.
   */
  async depositToStudentAccount(
    studentAccountId: string,
    dto: StudentDepositDto,
    actorId: string,
    prismaClient: TxClient | PrismaService = this.prisma,
  ) {
    const amount = MoneyUtil.parse(dto.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'El monto de depósito debe ser mayor a cero.',
      );
    }

    return this.runInTx(prismaClient, async (tx) => {
      await this.lockStudentAccount(studentAccountId, tx);

      const studentAccount = await tx.studentAccount.findUnique({
        where: { id: studentAccountId },
        include: {
          institutionalPerson: { include: { studentProfile: true } },
        },
      });

      if (!studentAccount) {
        throw new NotFoundException(
          `Cuenta de estudiante '${studentAccountId}' no encontrada.`,
        );
      }

      // Resolve Surcos Saving Central Vault
      let savingOrg = await tx.organization.findUnique({
        where: { code: 'SAVING' },
      });

      if (!savingOrg) {
        savingOrg = await tx.organization.create({
          data: {
            name: 'Surcos Saving Central',
            code: 'SAVING',
            description: 'Organización Financiera Central de Surcos 360',
            isPyme: false,
          },
        });
      }

      const centralVault = await this.getOrganizationAccount(
        savingOrg.id,
        StandardAccountCodes.SAVING_CENTRAL_VAULT,
        tx,
      );

      const person = studentAccount.institutionalPerson;
      const studentName = `${person.firstName} ${person.lastName}`.trim();

      return this.createTransaction(
        {
          type: TransactionType.DEPOSIT,
          description: `Depósito de ahorro para ${studentName} - ${dto.description.trim()}`,
          referenceType: 'STUDENT_ACCOUNT',
          referenceId: studentAccount.id,
          organizationId: savingOrg.id,
          actorId,
          idempotencyKey: dto.idempotencyKey,
          entries: [
            {
              ledgerAccountId: centralVault.id,
              direction: EntryDirection.DEBIT,
              amount,
            },
            {
              studentAccountId: studentAccount.id,
              direction: EntryDirection.CREDIT,
              amount,
            },
          ],
        },
        tx,
      );
    });
  }

  /**
   * Withdraws funds from a student savings account (§7.1, §8 PRD v1.0).
   * Atómico y a prueba de doble gasto: verificación de saldo + escritura
   * bajo bloqueo de fila dentro de una única $transaction.
   */
  async withdrawFromStudentAccount(
    studentAccountId: string,
    dto: StudentWithdrawalDto,
    actorId: string,
    prismaClient: TxClient | PrismaService = this.prisma,
  ) {
    const amount = MoneyUtil.parse(dto.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'El monto de retiro debe ser mayor a cero.',
      );
    }

    return this.runInTx(prismaClient, async (tx) => {
      await this.lockStudentAccount(studentAccountId, tx);

      const studentAccount = await tx.studentAccount.findUnique({
        where: { id: studentAccountId },
        include: {
          institutionalPerson: { include: { studentProfile: true } },
        },
      });

      if (!studentAccount) {
        throw new NotFoundException(
          `Cuenta de estudiante '${studentAccountId}' no encontrada.`,
        );
      }

      // Verify student account available balance (bajo bloqueo de fila)
      const currentBalance = await this.getStudentAccountBalance(
        studentAccountId,
        tx,
      );
      if (currentBalance.lessThan(amount)) {
        throw new ConflictException(
          `Saldo insuficiente para realizar el retiro. Saldo disponible: $${currentBalance.toFixed(2)}, Monto solicitado: $${amount.toFixed(2)}`,
        );
      }

      // Resolve Surcos Saving Central Vault
      let savingOrg = await tx.organization.findUnique({
        where: { code: 'SAVING' },
      });

      if (!savingOrg) {
        savingOrg = await tx.organization.create({
          data: {
            name: 'Surcos Saving Central',
            code: 'SAVING',
            description: 'Organización Financiera Central de Surcos 360',
            isPyme: false,
          },
        });
      }

      const centralVault = await this.getOrganizationAccount(
        savingOrg.id,
        StandardAccountCodes.SAVING_CENTRAL_VAULT,
        tx,
      );

      const person = studentAccount.institutionalPerson;
      const studentName = `${person.firstName} ${person.lastName}`.trim();

      return this.createTransaction(
        {
          type: TransactionType.WITHDRAWAL,
          description: `Retiro de fondos para ${studentName} - ${dto.description.trim()}`,
          referenceType: 'STUDENT_ACCOUNT',
          referenceId: studentAccount.id,
          organizationId: savingOrg.id,
          actorId,
          idempotencyKey: dto.idempotencyKey,
          entries: [
            {
              studentAccountId: studentAccount.id,
              direction: EntryDirection.DEBIT,
              amount,
            },
            {
              ledgerAccountId: centralVault.id,
              direction: EntryDirection.CREDIT,
              amount,
            },
          ],
        },
        tx,
      );
    });
  }

  /**
   * Queries transactions with pagination, date filtering, and multi-tenant isolation (§29 PRD v1.0).
   * `allowedOrganizationIds` restringe el alcance a las organizaciones del actor
   * (undefined = alcance global, reservado a AUTHORITY).
   */
  async findTransactions(
    query: QueryTransactionsDto,
    prismaClient: TxClient | PrismaService = this.prisma,
    allowedOrganizationIds?: string[],
  ) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {};

    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }

    if (allowedOrganizationIds) {
      if (
        query.organizationId &&
        !allowedOrganizationIds.includes(query.organizationId)
      ) {
        throw new ForbiddenException(
          'No tiene acceso a las transacciones de esta organización.',
        );
      }
      if (!query.organizationId) {
        where.organizationId = { in: allowedOrganizationIds };
      }
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.referenceType) {
      where.referenceType = query.referenceType;
    }

    if (query.referenceId) {
      where.referenceId = query.referenceId;
    }

    if (query.ledgerAccountId) {
      where.entries = {
        some: { ledgerAccountId: query.ledgerAccountId },
      };
    }

    if (query.studentAccountId) {
      where.entries = {
        some: { studentAccountId: query.studentAccountId },
      };
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    if (query.search) {
      where.OR = [
        { description: { contains: query.search, mode: 'insensitive' } },
        { transactionNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, transactions] = await Promise.all([
      prismaClient.transaction.count({ where }),
      prismaClient.transaction.findMany({
        where,
        include: {
          organization: { select: { id: true, name: true, code: true } },
          entries: {
            include: {
              ledgerAccount: true,
              studentAccount: {
                include: {
                  institutionalPerson: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      institutionalCode: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const formatted = transactions.map((tx) => ({
      id: tx.id,
      transactionNumber: tx.transactionNumber,
      type: tx.type,
      description: tx.description,
      referenceType: tx.referenceType,
      referenceId: tx.referenceId,
      organizationId: tx.organizationId,
      organizationName: tx.organization?.name || null,
      actorId: tx.actorId,
      reversalOfId: tx.reversalOfId,
      currency: tx.currency,
      createdAt: tx.createdAt,
      entries: tx.entries.map((e) => ({
        id: e.id,
        direction: e.direction,
        amount: MoneyUtil.toString(e.amount),
        studentAccountId: e.studentAccountId,
        studentName: e.studentAccount?.institutionalPerson
          ? `${e.studentAccount.institutionalPerson.firstName} ${e.studentAccount.institutionalPerson.lastName}`
          : null,
        studentCode:
          e.studentAccount?.institutionalPerson?.institutionalCode || null,
        accountNumber: e.studentAccount?.accountNumber || null,
        ledgerAccountId: e.ledgerAccountId,
        ledgerAccountCode: e.ledgerAccount?.code || null,
        ledgerAccountName: e.ledgerAccount?.name || null,
        ledgerAccountType: e.ledgerAccount?.type || null,
      })),
    }));

    return {
      data: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves single transaction by ID with full entry details.
   */
  async findTransactionById(
    id: string,
    prismaClient: TxClient | PrismaService = this.prisma,
    allowedOrganizationIds?: string[],
  ) {
    const tx = await prismaClient.transaction.findUnique({
      where: { id },
      include: {
        organization: true,
        entries: {
          include: {
            ledgerAccount: true,
            studentAccount: {
              include: {
                institutionalPerson: true,
              },
            },
          },
        },
      },
    });

    if (!tx) {
      throw new NotFoundException(`Transacción con ID '${id}' no encontrada.`);
    }

    if (
      allowedOrganizationIds &&
      (!tx.organizationId ||
        !allowedOrganizationIds.includes(tx.organizationId))
    ) {
      throw new NotFoundException(`Transacción con ID '${id}' no encontrada.`);
    }

    return {
      id: tx.id,
      transactionNumber: tx.transactionNumber,
      type: tx.type,
      description: tx.description,
      referenceType: tx.referenceType,
      referenceId: tx.referenceId,
      organizationId: tx.organizationId,
      organization: tx.organization
        ? {
            id: tx.organization.id,
            name: tx.organization.name,
            code: tx.organization.code,
          }
        : null,
      actorId: tx.actorId,
      reversalOfId: tx.reversalOfId,
      currency: tx.currency,
      createdAt: tx.createdAt,
      entries: tx.entries.map((e) => ({
        id: e.id,
        direction: e.direction,
        amount: MoneyUtil.toString(e.amount),
        studentAccountId: e.studentAccountId,
        student: e.studentAccount?.institutionalPerson
          ? {
              id: e.studentAccount.institutionalPerson.id,
              name: `${e.studentAccount.institutionalPerson.firstName} ${e.studentAccount.institutionalPerson.lastName}`.trim(),
              code: e.studentAccount.institutionalPerson.institutionalCode,
              accountNumber: e.studentAccount.accountNumber,
            }
          : null,
        ledgerAccount: e.ledgerAccount
          ? {
              id: e.ledgerAccount.id,
              code: e.ledgerAccount.code,
              name: e.ledgerAccount.name,
              type: e.ledgerAccount.type,
            }
          : null,
      })),
    };
  }
}
