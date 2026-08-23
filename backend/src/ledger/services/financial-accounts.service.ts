import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../ledger.service';
import { CreateLedgerAccountDto } from '../dto/create-ledger-account.dto';
import { AccountType, EntryDirection, Prisma } from '@prisma/client';
import { MoneyUtil } from '../../common/money';

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

@Injectable()
export class FinancialAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  /**
   * Lists all ledger accounts for an organization with real-time derived balances (§7, §28 PRD v1.0).
   */
  async getOrganizationAccounts(
    organizationId: string,
    allowedOrganizationIds?: string[],
  ) {
    if (
      allowedOrganizationIds &&
      !allowedOrganizationIds.includes(organizationId)
    ) {
      throw new ForbiddenException(
        'No tiene acceso a las cuentas de esta organización.',
      );
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new NotFoundException(
        `Organización con ID '${organizationId}' no encontrada.`,
      );
    }

    // Ensure standard accounts exist
    await this.ledgerService.ensureOrganizationAccounts(
      organizationId,
      org.code,
      org.name,
    );

    const accounts = await this.prisma.ledgerAccount.findMany({
      where: { organizationId },
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
    });

    const balances = await this.ledgerService.getLedgerAccountBalances(
      accounts.map((a) => a.id),
    );

    const accountsWithBalance = accounts.map((acc) => {
      const balance = balances.get(acc.id) ?? new Decimal(0);
      return {
        id: acc.id,
        organizationId: acc.organizationId,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        balance: MoneyUtil.toString(balance),
        createdAt: acc.createdAt,
      };
    });

    return {
      organization: {
        id: org.id,
        name: org.name,
        code: org.code,
      },
      accounts: accountsWithBalance,
    };
  }

  /**
   * Creates a new custom ledger account within an organization.
   */
  async createLedgerAccount(
    organizationId: string,
    dto: CreateLedgerAccountDto,
    allowedOrganizationIds?: string[],
  ) {
    if (
      allowedOrganizationIds &&
      !allowedOrganizationIds.includes(organizationId)
    ) {
      throw new ForbiddenException(
        'No tiene acceso a las cuentas de esta organización.',
      );
    }

    const code = dto.code.trim().toUpperCase();

    const existing = await this.prisma.ledgerAccount.findUnique({
      where: {
        organizationId_code: {
          organizationId,
          code,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Ya existe una cuenta con el código '${code}' en esta organización.`,
      );
    }

    const account = await this.prisma.ledgerAccount.create({
      data: {
        organizationId,
        code,
        name: dto.name.trim(),
        type: dto.type,
      },
    });

    return {
      id: account.id,
      organizationId: account.organizationId,
      code: account.code,
      name: account.name,
      type: account.type,
      balance: '0.00',
      createdAt: account.createdAt,
    };
  }

  /**
   * Retrieves account statement / detailed journal for a specific ledger account.
   */
  async getAccountStatement(
    accountId: string,
    query?: { startDate?: string; endDate?: string },
    allowedOrganizationIds?: string[],
  ) {
    const account = await this.prisma.ledgerAccount.findUnique({
      where: { id: accountId },
      include: {
        organization: { select: { id: true, name: true, code: true } },
      },
    });

    if (!account) {
      throw new NotFoundException(
        `Cuenta contable con ID '${accountId}' no encontrada.`,
      );
    }

    if (
      allowedOrganizationIds &&
      !allowedOrganizationIds.includes(account.organizationId)
    ) {
      throw new ForbiddenException(
        'No tiene acceso al detalle de esta cuenta contable.',
      );
    }

    const where: Prisma.LedgerEntryWhereInput = {
      ledgerAccountId: accountId,
    };

    if (query?.startDate || query?.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    // Opening balance calculation if startDate is specified
    let openingBalance = new Decimal(0);
    if (query?.startDate) {
      const priorEntries = await this.prisma.ledgerEntry.findMany({
        where: {
          ledgerAccountId: accountId,
          createdAt: { lt: new Date(query.startDate) },
        },
      });

      let priorDebits = new Decimal(0);
      let priorCredits = new Decimal(0);
      for (const p of priorEntries) {
        if (p.direction === EntryDirection.DEBIT)
          priorDebits = priorDebits.add(p.amount);
        else priorCredits = priorCredits.add(p.amount);
      }

      if (
        account.type === AccountType.ASSET ||
        account.type === AccountType.EXPENSE
      ) {
        openingBalance = priorDebits.sub(priorCredits);
      } else {
        openingBalance = priorCredits.sub(priorDebits);
      }
    }

    const entries = await this.prisma.ledgerEntry.findMany({
      where,
      include: {
        transaction: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    let runningBalance = new Decimal(openingBalance);
    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);

    const movements = entries.map((entry) => {
      if (entry.direction === EntryDirection.DEBIT) {
        totalDebits = totalDebits.add(entry.amount);
        if (
          account.type === AccountType.ASSET ||
          account.type === AccountType.EXPENSE
        ) {
          runningBalance = runningBalance.add(entry.amount);
        } else {
          runningBalance = runningBalance.sub(entry.amount);
        }
      } else {
        totalCredits = totalCredits.add(entry.amount);
        if (
          account.type === AccountType.ASSET ||
          account.type === AccountType.EXPENSE
        ) {
          runningBalance = runningBalance.sub(entry.amount);
        } else {
          runningBalance = runningBalance.add(entry.amount);
        }
      }

      return {
        id: entry.id,
        transactionId: entry.transactionId,
        transactionNumber: entry.transaction.transactionNumber,
        type: entry.transaction.type,
        description: entry.transaction.description,
        direction: entry.direction,
        amount: MoneyUtil.toString(entry.amount),
        runningBalance: MoneyUtil.toString(runningBalance),
        createdAt: entry.createdAt,
      };
    });

    const closingBalance =
      account.type === AccountType.ASSET || account.type === AccountType.EXPENSE
        ? openingBalance.add(totalDebits).sub(totalCredits)
        : openingBalance.add(totalCredits).sub(totalDebits);

    return {
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        organization: account.organization,
      },
      summary: {
        openingBalance: MoneyUtil.toString(openingBalance),
        totalDebits: MoneyUtil.toString(totalDebits),
        totalCredits: MoneyUtil.toString(totalCredits),
        closingBalance: MoneyUtil.toString(closingBalance),
        totalMovements: entries.length,
      },
      movements,
    };
  }
}
