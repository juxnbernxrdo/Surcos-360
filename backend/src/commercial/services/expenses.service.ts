import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../../ledger/ledger.service';
import { CreateExpenseDto, QueryExpensesDto } from '../dto/expense.dto';
import { Prisma, TransactionType, EntryDirection } from '@prisma/client';

const Decimal = Prisma.Decimal;

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  /**
   * Registers an operating expense and posts double-entry transaction.
   */
  async createExpense(orgId: string, dto: CreateExpenseDto, actorId: string) {
    const amountDecimal = new Decimal(dto.amount);
    if (amountDecimal.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'El monto del gasto debe ser mayor a cero.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Expense Record
      const expense = await tx.expense.create({
        data: {
          organizationId: orgId,
          category: dto.category.trim().toUpperCase(),
          description: dto.description.trim(),
          amount: amountDecimal,
          actorId,
          paymentMethod: dto.paymentMethod,
          referenceNumber: dto.referenceNumber?.trim() || null,
        },
      });

      // 2. Resolve standardized Ledger Accounts (Expense Account & Cash Vault)
      const org = await tx.organization.findUnique({
        where: { id: orgId },
      });
      const orgCode = org?.code || 'ORG';

      const expenseAccount = await this.ledgerService.getOrganizationAccount(
        orgId,
        `${orgCode}_OPERATING_EXPENSE`,
        tx,
      );
      const cashAccount = await this.ledgerService.getOrganizationAccount(
        orgId,
        `${orgCode}_CASH_VAULT`,
        tx,
      );

      // 3. Double-entry Ledger Transaction: DEBIT Expense / CREDIT Cash
      await this.ledgerService.createTransaction(
        {
          type: TransactionType.EXPENSE,
          description: `Gasto Operativo (${expense.category}): ${expense.description}`,
          referenceType: 'EXPENSE',
          referenceId: expense.id,
          actorId,
          entries: [
            {
              ledgerAccountId: expenseAccount.id,
              direction: EntryDirection.DEBIT,
              amount: amountDecimal,
            },
            {
              ledgerAccountId: cashAccount.id,
              direction: EntryDirection.CREDIT,
              amount: amountDecimal,
            },
          ],
        },
        tx,
      );

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          actorId,
          organizationId: orgId,
          action: 'CREATE_EXPENSE',
          entity: 'Expense',
          entityId: expense.id,
          newState: {
            category: expense.category,
            amount: expense.amount.toString(),
          },
        },
      });

      return expense;
    });
  }

  /**
   * Lists expenses for an organization.
   */
  async findAll(orgId: string, query: QueryExpensesDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseWhereInput = {
      organizationId: orgId,
    };

    if (query.category) {
      where.category = query.category.toUpperCase();
    }

    if (query.search) {
      where.description = { contains: query.search, mode: 'insensitive' };
    }

    const [total, expenses] = await Promise.all([
      this.prisma.expense.count({ where }),
      this.prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: expenses,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
