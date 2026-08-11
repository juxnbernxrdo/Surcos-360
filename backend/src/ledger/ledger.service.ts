import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntryDirection, TransactionType, Prisma } from '@prisma/client';
type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

export interface LedgerEntryInput {
  studentAccountId?: string;
  ledgerAccountId?: string;
  direction: EntryDirection;
  amount: number | string | Decimal;
}

export interface CreateTransactionInput {
  type: TransactionType;
  description: string;
  referenceType?: string;
  referenceId?: string;
  actorId: string;
  entries: LedgerEntryInput[];
}

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a balanced double-entry transaction.
   * Enforces SUM(DEBIT) == SUM(CREDIT).
   */
  async createTransaction(input: CreateTransactionInput) {
    if (!input.entries || input.entries.length < 2) {
      throw new BadRequestException('Double-entry transaction must contain at least 2 entries.');
    }

    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    for (const entry of input.entries) {
      const amountDecimal = new Decimal(entry.amount.toString());
      if (amountDecimal.lessThanOrEqualTo(0)) {
        throw new BadRequestException('Ledger entry amount must be greater than 0.');
      }

      if (!entry.studentAccountId && !entry.ledgerAccountId) {
        throw new BadRequestException('Each entry must specify either a studentAccountId or a ledgerAccountId.');
      }

      if (entry.direction === EntryDirection.DEBIT) {
        totalDebit = totalDebit.add(amountDecimal);
      } else if (entry.direction === EntryDirection.CREDIT) {
        totalCredit = totalCredit.add(amountDecimal);
      }
    }

    if (!totalDebit.equals(totalCredit)) {
      throw new BadRequestException(
        `Unbalanced double-entry transaction! Total DEBIT (${totalDebit.toString()}) does not equal Total CREDIT (${totalCredit.toString()}).`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          type: input.type,
          description: input.description,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          actorId: input.actorId,
        },
      });

      const entryPromises = input.entries.map((e) =>
        tx.ledgerEntry.create({
          data: {
            transactionId: transaction.id,
            studentAccountId: e.studentAccountId,
            ledgerAccountId: e.ledgerAccountId,
            direction: e.direction,
            amount: new Decimal(e.amount.toString()),
          },
        }),
      );

      await Promise.all(entryPromises);
      return transaction;
    });
  }

  /**
   * Calculates derived balance for a StudentAccount from append-only ledger entries.
   */
  async getStudentAccountBalance(studentAccountId: string): Promise<Decimal> {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { studentAccountId },
    });

    let balance = new Decimal(0);
    for (const entry of entries) {
      if (entry.direction === EntryDirection.CREDIT) {
        // CREDIT increases Student Wallet/Liability
        balance = balance.add(entry.amount);
      } else if (entry.direction === EntryDirection.DEBIT) {
        // DEBIT decreases Student Wallet/Liability (e.g. Purchase)
        balance = balance.sub(entry.amount);
      }
    }

    return balance;
  }
}
