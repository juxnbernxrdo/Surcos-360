import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../../ledger/ledger.service';
import { StudentStatementQueryDto } from '../dto/student-statement-query.dto';
import { StudentStatsQueryDto } from '../dto/student-stats-query.dto';
import { StudentReportQueryDto } from '../dto/student-report-query.dto';
import {
  UserType,
  EntryDirection,
  TransactionType,
  Prisma,
} from '@prisma/client';
import { MoneyUtil } from '../../common/money';

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

interface TransactionWithOrg {
  organizationId?: string | null;
  organization?: { name?: string | null } | null;
}

@Injectable()
export class StudentAnalyticsService {
  private readonly logger = new Logger(StudentAnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  /**
   * Resuelve el nombre del PYME/comercio a partir de la organización vinculada
   * a la transacción (fuente canónica). Evita heurísticas por palabras clave.
   */
  private resolvePymeName(tx: TransactionWithOrg): string {
    const orgName = tx.organization?.name?.trim();
    if (orgName) return orgName;
    if (tx.organizationId) return 'PYME';
    return 'Surcos Saving';
  }

  /**
   * Helper to resolve InstitutionalPerson by userId or person id.
   * Cuando se provee `scope` (contexto de actor administrativo), se aplica
   * aislamiento multi-tenant por institución salvo para AUTHORITY global.
   */
  async resolveStudentPerson(
    identifier: string,
    scope?: { userType?: UserType; institutionId?: string | null },
  ) {
    const where: Prisma.InstitutionalPersonWhereInput = {
      OR: [{ userId: identifier }, { id: identifier }],
      userType: UserType.STUDENT,
    };

    if (scope && scope.userType !== UserType.AUTHORITY && scope.institutionId) {
      where.institutionId = scope.institutionId;
    }

    return this.prisma.institutionalPerson.findFirst({
      where,
      include: {
        studentProfile: {
          include: {
            representative: {
              include: {
                institutionalPerson: true,
              },
            },
          },
        },
        studentAccount: true,
      },
    });
  }

  private transactionInclude() {
    return {
      transaction: {
        include: {
          organization: { select: { id: true, name: true, code: true } },
        },
      },
    };
  }

  /**
   * Resolves full dashboard for student (§6.2 PRD v1.0).
   */
  async getStudentDashboard(
    identifier: string,
    scope?: { userType?: UserType; institutionId?: string | null },
  ) {
    const person = await this.resolveStudentPerson(identifier, scope);

    if (!person) {
      throw new NotFoundException(
        'Perfil de estudiante no encontrado para el usuario autenticado.',
      );
    }

    if (!person.studentAccount) {
      throw new NotFoundException(
        'Cuenta financiera no encontrada para el estudiante.',
      );
    }

    const studentAccountId = person.studentAccount.id;

    // Saldo autoritativo derivado del motor contable central
    const currentBalance =
      await this.ledgerService.getStudentAccountBalance(studentAccountId);

    // Fetch all ledger entries for this student account
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { studentAccountId },
      include: this.transactionInclude(),
      orderBy: { createdAt: 'desc' },
    });

    let initialBalance = new Decimal(0);
    let totalExpenses = new Decimal(0);

    const activities: Array<{
      id: string;
      storeName: string;
      description: string;
      amount: string;
      type: string;
      date: string;
      reference: string;
      status: string;
    }> = [];

    for (const entry of entries) {
      const amt = entry.amount;
      const txType = entry.transaction.type;

      if (entry.direction === EntryDirection.CREDIT) {
        if (txType === TransactionType.INITIAL_BALANCE) {
          initialBalance = initialBalance.add(amt);
        } else if (txType === TransactionType.REFUND) {
          totalExpenses = totalExpenses.sub(amt);
        }
      } else if (entry.direction === EntryDirection.DEBIT) {
        if (
          txType === TransactionType.PURCHASE ||
          txType === TransactionType.WITHDRAWAL ||
          txType === TransactionType.EXPENSE ||
          txType === TransactionType.RENTAL_FEE ||
          txType === TransactionType.VISIT_FEE
        ) {
          totalExpenses = totalExpenses.add(amt);
        }
      }

      const storeName = this.resolvePymeName(entry.transaction);

      const signedAmount = MoneyUtil.signed(
        amt,
        entry.direction === EntryDirection.DEBIT,
      );

      activities.push({
        id: entry.id,
        storeName,
        description: entry.transaction.description,
        amount: signedAmount,
        type: txType,
        date: entry.createdAt.toISOString(),
        reference:
          entry.transaction?.transactionNumber ||
          entry.transaction?.referenceId ||
          (entry.transaction?.id
            ? `TX-${entry.transaction.id.slice(0, 8)}`
            : 'TX-REF'),
        status: 'COMPLETED',
      });
    }

    return {
      student: {
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
        email: person.email,
        institutionalCode: person.institutionalCode,
        course: person.studentProfile?.course || '3ro BGU "A"',
        tutor: person.studentProfile?.tutor || 'Sin tutor asignado',
        academicYear: person.studentProfile?.academicYear || '2026-2027',
        status: person.status,
      },
      financials: {
        accountNumber: person.studentAccount.accountNumber,
        initialBalance: MoneyUtil.toString(initialBalance),
        savedAmount: MoneyUtil.toString(currentBalance),
        totalExpenses: MoneyUtil.toString(totalExpenses),
        currentBalance: MoneyUtil.toString(currentBalance),
      },
      recentActivity: activities.slice(0, 10),
    };
  }

  /**
   * Retrieves full paginated statement / movements history with filtering (§6.3 PRD v1.0).
   */
  async getStudentStatement(
    identifier: string,
    query: StudentStatementQueryDto,
    scope?: { userType?: UserType; institutionId?: string | null },
  ) {
    const person = await this.resolveStudentPerson(identifier, scope);

    if (!person || !person.studentAccount) {
      throw new NotFoundException('Cuenta de estudiante no encontrada.');
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.LedgerEntryWhereInput = {
      studentAccountId: person.studentAccount.id,
    };

    if (query.type || query.pyme) {
      where.transaction = {};
      if (query.type) {
        where.transaction.type = query.type;
      }
      if (query.pyme) {
        // Filtro por organización del PYME aplicado en la BD (no post-paginación)
        where.transaction.organization = {
          name: { contains: query.pyme.trim(), mode: 'insensitive' },
        };
      }
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

    const [total, entries, currentBalanceDecimal] = await Promise.all([
      this.prisma.ledgerEntry.count({ where }),
      this.prisma.ledgerEntry.findMany({
        where,
        include: this.transactionInclude(),
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.ledgerService.getStudentAccountBalance(person.studentAccount.id),
    ]);

    const formattedEntries = entries.map((entry) => {
      const signedAmount = MoneyUtil.signed(
        entry.amount,
        entry.direction === EntryDirection.DEBIT,
      );

      const storeName = this.resolvePymeName(entry.transaction);

      return {
        id: entry.id,
        transactionId: entry.transactionId,
        date: entry.createdAt.toISOString(),
        pyme: storeName,
        concept: entry.transaction.description,
        type: entry.transaction.type,
        direction: entry.direction,
        amount: MoneyUtil.toString(entry.amount),
        signedAmount,
        reference:
          entry.transaction?.transactionNumber ||
          entry.transaction?.referenceId ||
          (entry.transaction?.id
            ? `TX-${entry.transaction.id.slice(0, 8)}`
            : 'TX-REF'),
        status: 'COMPLETED',
        createdAt: entry.createdAt,
      };
    });

    return {
      accountNumber: person.studentAccount.accountNumber,
      currentBalance: MoneyUtil.toString(currentBalanceDecimal),
      data: formattedEntries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Calculates financial analytics and spending statistics strictly from General Ledger.
   */
  async getStudentStatistics(
    identifier: string,
    query?: StudentStatsQueryDto,
    scope?: { userType?: UserType; institutionId?: string | null },
  ) {
    const person = await this.resolveStudentPerson(identifier, scope);

    if (!person || !person.studentAccount) {
      throw new NotFoundException('Cuenta de estudiante no encontrada.');
    }

    const where: Prisma.LedgerEntryWhereInput = {
      studentAccountId: person.studentAccount.id,
    };

    if (query?.startDate || query?.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    const entries = await this.prisma.ledgerEntry.findMany({
      where,
      include: this.transactionInclude(),
      orderBy: { createdAt: 'asc' },
    });

    let totalInflows = new Decimal(0);
    let totalOutflows = new Decimal(0);
    let purchaseCount = 0;
    let spendCount = 0;

    const pymeBreakdown: Record<
      string,
      { totalAmount: Decimal; transactionCount: number }
    > = {};

    const monthlyTrend: Record<string, { totalSpent: Decimal; count: number }> =
      {};

    for (const entry of entries) {
      const amt = entry.amount;
      const txType = entry.transaction.type;
      const storeName = this.resolvePymeName(entry.transaction);

      if (entry.direction === EntryDirection.CREDIT) {
        totalInflows = totalInflows.add(amt);
      } else if (entry.direction === EntryDirection.DEBIT) {
        totalOutflows = totalOutflows.add(amt);
        spendCount++;

        // purchaseCount: solo compras reales (PURCHASE), no retiros/gastos
        if (txType === TransactionType.PURCHASE) {
          purchaseCount++;
        }

        // PYME Breakdown
        if (!pymeBreakdown[storeName]) {
          pymeBreakdown[storeName] = {
            totalAmount: new Decimal(0),
            transactionCount: 0,
          };
        }
        pymeBreakdown[storeName].totalAmount =
          pymeBreakdown[storeName].totalAmount.add(amt);
        pymeBreakdown[storeName].transactionCount++;

        // Monthly Trend
        const monthKey = `${entry.createdAt.getFullYear()}-${String(
          entry.createdAt.getMonth() + 1,
        ).padStart(2, '0')}`;
        if (!monthlyTrend[monthKey]) {
          monthlyTrend[monthKey] = { totalSpent: new Decimal(0), count: 0 };
        }
        monthlyTrend[monthKey].totalSpent =
          monthlyTrend[monthKey].totalSpent.add(amt);
        monthlyTrend[monthKey].count++;
      }
    }

    const currentBalance = totalInflows.sub(totalOutflows);

    // Ordenar por monto (Decimal) antes de formatear como string
    const pymeStats = Object.keys(pymeBreakdown)
      .map((pymeName) => {
        const data = pymeBreakdown[pymeName];
        const amount = data.totalAmount;
        const percentage = totalOutflows.greaterThan(0)
          ? Number(amount.div(totalOutflows).mul(100).toFixed(1))
          : 0;

        return {
          pyme: pymeName,
          totalAmount: amount,
          percentage,
          transactionCount: data.transactionCount,
        };
      })
      .sort((a, b) => b.totalAmount.minus(a.totalAmount).toNumber());

    const topSpendingPyme =
      pymeStats.length > 0 && pymeStats[0].totalAmount.greaterThan(0)
        ? pymeStats[0].pyme
        : 'Ninguna';

    // Average transaction amount (sobre todos los movimientos de gasto)
    const averageExpense =
      spendCount > 0 ? totalOutflows.div(spendCount) : new Decimal(0);

    const formattedTrend = Object.keys(monthlyTrend)
      .sort()
      .map((month) => ({
        month,
        totalSpent: MoneyUtil.toString(monthlyTrend[month].totalSpent),
        transactionCount: monthlyTrend[month].count,
      }));

    return {
      accountNumber: person.studentAccount.accountNumber,
      summary: {
        totalInflows: MoneyUtil.toString(totalInflows),
        totalExpenses: MoneyUtil.toString(totalOutflows),
        currentBalance: MoneyUtil.toString(currentBalance),
        totalTransactions: entries.length,
        totalPurchases: purchaseCount,
        averageExpense: MoneyUtil.toString(averageExpense),
        topSpendingPyme,
      },
      pymeBreakdown: pymeStats.map((p) => ({
        pyme: p.pyme,
        totalAmount: MoneyUtil.toString(p.totalAmount),
        transactionCount: p.transactionCount,
        percentage: p.percentage,
      })),
      monthlyTrend: formattedTrend,
    };
  }

  /**
   * Generates a formal structured financial statement / certificate report (§24 PRD v1.0).
   */
  async getStudentReport(
    identifier: string,
    query?: StudentReportQueryDto,
    scope?: { userType?: UserType; institutionId?: string | null },
  ) {
    const person = await this.resolveStudentPerson(identifier, scope);

    if (!person || !person.studentAccount) {
      throw new NotFoundException('Cuenta de estudiante no encontrada.');
    }

    const where: Prisma.LedgerEntryWhereInput = {
      studentAccountId: person.studentAccount.id,
    };

    if (query?.startDate || query?.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    // Saldo inicial derivado por el motor contable central (hasta antes del período)
    const openingBalance = query?.startDate
      ? await this.ledgerService.getStudentAccountBalanceAsOf(
          person.studentAccount.id,
          new Date(query.startDate),
        )
      : new Decimal(0);

    const periodEntries = await this.prisma.ledgerEntry.findMany({
      where,
      include: this.transactionInclude(),
      orderBy: { createdAt: 'asc' },
    });

    let periodCredits = new Decimal(0);
    let periodDebits = new Decimal(0);
    let runningBalance = new Decimal(openingBalance);

    const itemizedMovements = periodEntries.map((entry) => {
      const amt = entry.amount;
      if (entry.direction === EntryDirection.CREDIT) {
        periodCredits = periodCredits.add(amt);
        runningBalance = runningBalance.add(amt);
      } else {
        periodDebits = periodDebits.add(amt);
        runningBalance = runningBalance.sub(amt);
      }

      const storeName = this.resolvePymeName(entry.transaction);

      return {
        id: entry.id,
        date: entry.createdAt.toISOString(),
        pyme: storeName,
        concept: entry.transaction.description,
        type: entry.transaction.type,
        direction: entry.direction,
        amount: MoneyUtil.toString(amt),
        runningBalance: MoneyUtil.toString(runningBalance),
        reference:
          entry.transaction?.transactionNumber ||
          entry.transaction?.referenceId ||
          'TX-REF',
      };
    });

    const closingBalance = openingBalance.add(periodCredits).sub(periodDebits);

    const rep = person.studentProfile?.representative;
    const representativeInfo = rep
      ? {
          name: `${rep.institutionalPerson.firstName} ${rep.institutionalPerson.lastName}`.trim(),
          email: rep.institutionalPerson.email,
          phone: rep.phoneNumber || 'N/A',
          identification: rep.identificationNumber || 'N/A',
        }
      : null;

    return {
      reportId: `REP-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`,
      generatedAt: new Date().toISOString(),
      institution: {
        id: person.institutionId,
        name: 'Unidad Educativa Surcos',
        system: 'Surcos 360 Enterprise',
      },
      student: {
        id: person.id,
        fullName: `${person.firstName} ${person.lastName}`.trim(),
        email: person.email,
        institutionalCode: person.institutionalCode,
        course: person.studentProfile?.course || 'N/A',
        academicYear: person.studentProfile?.academicYear || '2026-2027',
        tutor: person.studentProfile?.tutor || 'N/A',
        accountNumber: person.studentAccount.accountNumber,
      },
      representative: representativeInfo,
      period: {
        startDate: query?.startDate || 'Inicio del historial',
        endDate: query?.endDate || 'Actualidad',
      },
      financialSummary: {
        openingBalance: MoneyUtil.toString(openingBalance),
        totalCredits: MoneyUtil.toString(periodCredits),
        totalDebits: MoneyUtil.toString(periodDebits),
        closingBalance: MoneyUtil.toString(closingBalance),
        transactionCount: periodEntries.length,
      },
      movements: itemizedMovements,
    };
  }
}
