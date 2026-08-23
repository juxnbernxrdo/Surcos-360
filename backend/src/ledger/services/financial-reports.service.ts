import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../ledger.service';
import { AccountType, EntryDirection, Prisma } from '@prisma/client';
import { MoneyUtil } from '../../common/money';

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

@Injectable()
export class FinancialReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  /**
   * Generates a Trial Balance (Balance de Comprobación) (§28 PRD v1.0).
   * Invariant: Total Debit Balances == Total Credit Balances.
   */
  async getTrialBalance(
    organizationId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const whereAccount: Prisma.LedgerAccountWhereInput = {};
    if (organizationId) {
      whereAccount.organizationId = organizationId;
    }

    const accounts = await this.prisma.ledgerAccount.findMany({
      where: whereAccount,
      include: {
        organization: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ organizationId: 'asc' }, { code: 'asc' }],
    });

    let grandTotalDebits = new Decimal(0);
    let grandTotalCredits = new Decimal(0);

    const rows = await Promise.all(
      accounts.map(async (acc) => {
        const whereEntry: Prisma.LedgerEntryWhereInput = {
          ledgerAccountId: acc.id,
        };

        if (startDate || endDate) {
          whereEntry.createdAt = {};
          if (startDate) whereEntry.createdAt.gte = new Date(startDate);
          if (endDate) whereEntry.createdAt.lte = new Date(endDate);
        }

        const entries = await this.prisma.ledgerEntry.findMany({
          where: whereEntry,
        });

        let debits = new Decimal(0);
        let credits = new Decimal(0);

        for (const e of entries) {
          if (e.direction === EntryDirection.DEBIT) {
            debits = debits.add(e.amount);
          } else {
            credits = credits.add(e.amount);
          }
        }

        grandTotalDebits = grandTotalDebits.add(debits);
        grandTotalCredits = grandTotalCredits.add(credits);

        let debitBalance = new Decimal(0);
        let creditBalance = new Decimal(0);

        if (
          acc.type === AccountType.ASSET ||
          acc.type === AccountType.EXPENSE
        ) {
          if (debits.greaterThan(credits)) {
            debitBalance = debits.sub(credits);
          } else {
            creditBalance = credits.sub(debits);
          }
        } else {
          if (credits.greaterThan(debits)) {
            creditBalance = credits.sub(debits);
          } else {
            debitBalance = debits.sub(credits);
          }
        }

        return {
          accountId: acc.id,
          accountCode: acc.code,
          accountName: acc.name,
          accountType: acc.type,
          organization: acc.organization,
          totalDebits: MoneyUtil.toString(debits),
          totalCredits: MoneyUtil.toString(credits),
          debitBalance: MoneyUtil.toString(debitBalance),
          creditBalance: MoneyUtil.toString(creditBalance),
        };
      }),
    );

    // If global (or Saving), also include Student Accounts consolidated
    if (!organizationId) {
      const studentEntriesWhere: Prisma.LedgerEntryWhereInput = {
        studentAccountId: { not: null },
      };
      if (startDate || endDate) {
        studentEntriesWhere.createdAt = {};
        if (startDate) studentEntriesWhere.createdAt.gte = new Date(startDate);
        if (endDate) studentEntriesWhere.createdAt.lte = new Date(endDate);
      }

      const studentEntries = await this.prisma.ledgerEntry.findMany({
        where: studentEntriesWhere,
      });

      let stuDebits = new Decimal(0);
      let stuCredits = new Decimal(0);
      for (const se of studentEntries) {
        if (se.direction === EntryDirection.DEBIT) {
          stuDebits = stuDebits.add(se.amount);
        } else {
          stuCredits = stuCredits.add(se.amount);
        }
      }

      grandTotalDebits = grandTotalDebits.add(stuDebits);
      grandTotalCredits = grandTotalCredits.add(stuCredits);

      const stuBalance = stuCredits.sub(stuDebits);
      rows.push({
        accountId: 'STUDENT_ACCOUNTS_AGGREGATE',
        accountCode: 'STUDENT_WALLETS_TOTAL',
        accountName: 'Consolidado Billeteras de Ahorro Estudiantil',
        accountType: AccountType.STUDENT_WALLET,
        organization: {
          id: 'saving-central',
          name: 'Surcos Saving',
          code: 'SAVING',
        },
        totalDebits: MoneyUtil.toString(stuDebits),
        totalCredits: MoneyUtil.toString(stuCredits),
        debitBalance: stuBalance.lessThan(0)
          ? MoneyUtil.toString(stuBalance.abs())
          : '0.00',
        creditBalance: stuBalance.greaterThanOrEqualTo(0)
          ? MoneyUtil.toString(stuBalance)
          : '0.00',
      });
    }

    const isBalanced = grandTotalDebits.equals(grandTotalCredits);

    return {
      report: 'TRIAL_BALANCE',
      generatedAt: new Date().toISOString(),
      period: {
        startDate: startDate || 'Inicio histórico',
        endDate: endDate || 'Actualidad',
      },
      organizationId: organizationId || 'ALL_ORGANIZATIONS',
      isBalanced,
      totals: {
        grandTotalDebits: MoneyUtil.toString(grandTotalDebits),
        grandTotalCredits: MoneyUtil.toString(grandTotalCredits),
        difference: MoneyUtil.toString(
          grandTotalDebits.sub(grandTotalCredits).abs(),
        ),
      },
      accounts: rows,
    };
  }

  /**
   * Generates Income Statement (Estado de Resultados / P&L) for an Organization (§28 PRD v1.0).
   * Revenue - COGS = Gross Profit
   * Gross Profit - Expenses = Net Income
   */
  async getIncomeStatement(
    organizationId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new NotFoundException(
        `Organización con ID '${organizationId}' no encontrada.`,
      );
    }

    const accounts = await this.prisma.ledgerAccount.findMany({
      where: {
        organizationId,
        type: { in: [AccountType.REVENUE, AccountType.EXPENSE] },
      },
    });

    let totalRevenue = new Decimal(0);
    let totalCogs = new Decimal(0);
    let totalOperatingExpenses = new Decimal(0);

    const revenueBreakdown: Array<{
      code: string;
      name: string;
      amount: string;
    }> = [];
    const expenseBreakdown: Array<{
      code: string;
      name: string;
      amount: string;
    }> = [];
    const cogsBreakdown: Array<{ code: string; name: string; amount: string }> =
      [];

    for (const acc of accounts) {
      const whereEntry: Prisma.LedgerEntryWhereInput = {
        ledgerAccountId: acc.id,
      };
      if (startDate || endDate) {
        whereEntry.createdAt = {};
        if (startDate) whereEntry.createdAt.gte = new Date(startDate);
        if (endDate) whereEntry.createdAt.lte = new Date(endDate);
      }

      const entries = await this.prisma.ledgerEntry.findMany({
        where: whereEntry,
      });

      let debits = new Decimal(0);
      let credits = new Decimal(0);
      for (const e of entries) {
        if (e.direction === EntryDirection.DEBIT) debits = debits.add(e.amount);
        else credits = credits.add(e.amount);
      }

      if (acc.type === AccountType.REVENUE) {
        const netRev = credits.sub(debits);
        if (netRev.greaterThan(0)) {
          totalRevenue = totalRevenue.add(netRev);
          revenueBreakdown.push({
            code: acc.code,
            name: acc.name,
            amount: MoneyUtil.toString(netRev),
          });
        }
      } else if (acc.type === AccountType.EXPENSE) {
        const netExp = debits.sub(credits);
        if (netExp.greaterThan(0)) {
          if (acc.code.toUpperCase().includes('COGS')) {
            totalCogs = totalCogs.add(netExp);
            cogsBreakdown.push({
              code: acc.code,
              name: acc.name,
              amount: MoneyUtil.toString(netExp),
            });
          } else {
            totalOperatingExpenses = totalOperatingExpenses.add(netExp);
            expenseBreakdown.push({
              code: acc.code,
              name: acc.name,
              amount: MoneyUtil.toString(netExp),
            });
          }
        }
      }
    }

    const grossProfit = totalRevenue.sub(totalCogs);
    const netIncome = grossProfit.sub(totalOperatingExpenses);

    return {
      report: 'INCOME_STATEMENT',
      generatedAt: new Date().toISOString(),
      organization: {
        id: org.id,
        name: org.name,
        code: org.code,
      },
      period: {
        startDate: startDate || 'Inicio histórico',
        endDate: endDate || 'Actualidad',
      },
      summary: {
        totalRevenue: MoneyUtil.toString(totalRevenue),
        totalCogs: MoneyUtil.toString(totalCogs),
        grossProfit: MoneyUtil.toString(grossProfit),
        grossMarginPercentage: totalRevenue.greaterThan(0)
          ? Number(grossProfit.div(totalRevenue).mul(100).toFixed(2))
          : 0,
        totalOperatingExpenses: MoneyUtil.toString(totalOperatingExpenses),
        netIncome: MoneyUtil.toString(netIncome),
        netMarginPercentage: totalRevenue.greaterThan(0)
          ? Number(netIncome.div(totalRevenue).mul(100).toFixed(2))
          : 0,
      },
      revenueBreakdown,
      cogsBreakdown,
      expenseBreakdown,
    };
  }

  /**
   * Generates Balance Sheet (Balance General) for an Organization (§28 PRD v1.0).
   * Total Assets = Total Liabilities + Equity (including retained earnings).
   */
  async getBalanceSheet(organizationId: string, asOfDate?: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new NotFoundException(
        `Organización con ID '${organizationId}' no encontrada.`,
      );
    }

    const accounts = await this.prisma.ledgerAccount.findMany({
      where: { organizationId },
    });

    let totalAssets = new Decimal(0);
    let totalLiabilities = new Decimal(0);
    let totalEquity = new Decimal(0);

    const assetAccounts: Array<{ code: string; name: string; amount: string }> =
      [];
    const liabilityAccounts: Array<{
      code: string;
      name: string;
      amount: string;
    }> = [];
    const equityAccounts: Array<{
      code: string;
      name: string;
      amount: string;
    }> = [];

    // Calculate revenue and expenses up to asOfDate to derive Retained Earnings
    let cumulativeRevenues = new Decimal(0);
    let cumulativeExpenses = new Decimal(0);

    for (const acc of accounts) {
      const whereEntry: Prisma.LedgerEntryWhereInput = {
        ledgerAccountId: acc.id,
      };
      if (asOfDate) {
        whereEntry.createdAt = { lte: new Date(asOfDate) };
      }

      const entries = await this.prisma.ledgerEntry.findMany({
        where: whereEntry,
      });

      let debits = new Decimal(0);
      let credits = new Decimal(0);
      for (const e of entries) {
        if (e.direction === EntryDirection.DEBIT) debits = debits.add(e.amount);
        else credits = credits.add(e.amount);
      }

      if (acc.type === AccountType.ASSET) {
        const val = debits.sub(credits);
        totalAssets = totalAssets.add(val);
        assetAccounts.push({
          code: acc.code,
          name: acc.name,
          amount: MoneyUtil.toString(val),
        });
      } else if (acc.type === AccountType.LIABILITY) {
        const val = credits.sub(debits);
        totalLiabilities = totalLiabilities.add(val);
        liabilityAccounts.push({
          code: acc.code,
          name: acc.name,
          amount: MoneyUtil.toString(val),
        });
      } else if (acc.type === AccountType.EQUITY) {
        const val = credits.sub(debits);
        totalEquity = totalEquity.add(val);
        equityAccounts.push({
          code: acc.code,
          name: acc.name,
          amount: MoneyUtil.toString(val),
        });
      } else if (acc.type === AccountType.REVENUE) {
        cumulativeRevenues = cumulativeRevenues.add(credits.sub(debits));
      } else if (acc.type === AccountType.EXPENSE) {
        cumulativeExpenses = cumulativeExpenses.add(debits.sub(credits));
      }
    }

    // Retained earnings = cumulative revenue - cumulative expenses
    const retainedEarnings = cumulativeRevenues.sub(cumulativeExpenses);
    const totalLiabilitiesAndEquity = totalLiabilities
      .add(totalEquity)
      .add(retainedEarnings);

    return {
      report: 'BALANCE_SHEET',
      generatedAt: new Date().toISOString(),
      asOfDate: asOfDate || 'Actualidad',
      organization: {
        id: org.id,
        name: org.name,
        code: org.code,
      },
      assets: {
        totalAssets: MoneyUtil.toString(totalAssets),
        accounts: assetAccounts,
      },
      liabilities: {
        totalLiabilities: MoneyUtil.toString(totalLiabilities),
        accounts: liabilityAccounts,
      },
      equity: {
        baseEquity: MoneyUtil.toString(totalEquity),
        retainedEarnings: MoneyUtil.toString(retainedEarnings),
        totalEquity: MoneyUtil.toString(totalEquity.add(retainedEarnings)),
        accounts: equityAccounts,
      },
      totalLiabilitiesAndEquity: MoneyUtil.toString(totalLiabilitiesAndEquity),
      isBalanced: totalAssets.equals(totalLiabilitiesAndEquity),
    };
  }

  /**
   * Consolidated Governance Overview for Surcos Saving Authorities (§7.1, §7.2 PRD v1.0).
   */
  async getInstitutionalOverview(asOfDate?: string) {
    const orgs = await this.prisma.organization.findMany({
      orderBy: { code: 'asc' },
    });

    // 1. Total Student Savings in Custody
    const studentEntries = await this.prisma.ledgerEntry.findMany({
      where: { studentAccountId: { not: null } },
    });

    let studentDeposits = new Decimal(0);
    let studentExpenses = new Decimal(0);
    for (const se of studentEntries) {
      if (se.direction === EntryDirection.CREDIT)
        studentDeposits = studentDeposits.add(se.amount);
      else studentExpenses = studentExpenses.add(se.amount);
    }
    const totalStudentSavingsCustody = studentDeposits.sub(studentExpenses);
    const totalStudentAccounts = await this.prisma.studentAccount.count();

    // 2. Per-PYME performance summary
    const pymePerformances = await Promise.all(
      orgs
        .filter((o) => o.code !== 'SAVING')
        .map(async (org) => {
          const is = await this.getIncomeStatement(org.id);
          const bs = await this.getBalanceSheet(org.id);
          return {
            organizationId: org.id,
            name: org.name,
            code: org.code,
            revenue: is.summary.totalRevenue,
            cogs: is.summary.totalCogs,
            grossProfit: is.summary.grossProfit,
            operatingExpenses: is.summary.totalOperatingExpenses,
            netIncome: is.summary.netIncome,
            totalAssets: bs.assets.totalAssets,
            totalLiabilities: bs.liabilities.totalLiabilities,
          };
        }),
    );

    // 3. Surcos Saving Central Vault
    const savingOrg = orgs.find((o) => o.code === 'SAVING');
    let centralVaultBalance = '0.00';
    if (savingOrg) {
      const vaultAcc = await this.prisma.ledgerAccount.findFirst({
        where: {
          organizationId: savingOrg.id,
          code: 'SAVING_CENTRAL_VAULT',
        },
      });
      if (vaultAcc) {
        const bal = await this.ledgerService.getLedgerAccountBalance(
          vaultAcc.id,
        );
        centralVaultBalance = MoneyUtil.toString(bal);
      }
    }

    return {
      report: 'INSTITUTIONAL_OVERVIEW',
      generatedAt: new Date().toISOString(),
      asOfDate: asOfDate || 'Actualidad',
      surcosSaving: {
        centralVaultLiquidity: centralVaultBalance,
        totalStudentAccounts,
        totalStudentSavingsInCustody: MoneyUtil.toString(
          totalStudentSavingsCustody,
        ),
        totalGrossDeposits: MoneyUtil.toString(studentDeposits),
        totalStudentOutflows: MoneyUtil.toString(studentExpenses),
      },
      pymes: pymePerformances,
    };
  }
}
