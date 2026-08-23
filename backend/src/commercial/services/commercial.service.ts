import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CommercialService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Computes comprehensive commercial KPIs and summary for the given PYME organization (§8 PRD v1.0).
   */
  async getCommercialSummary(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new NotFoundException(
        `Organización con ID '${orgId}' no encontrada.`,
      );
    }

    const [
      productsCount,
      suppliersCount,
      customersCount,
      assetsCount,
      liabilitiesCount,
      expensesAgg,
      salesAgg,
      purchasesAgg,
      products,
      assets,
    ] = await Promise.all([
      this.prisma.product.count({ where: { organizationId: orgId } }),
      this.prisma.supplier.count({ where: { organizationId: orgId } }),
      this.prisma.customer.count({
        where: {
          OR: [{ organizationId: orgId }, { organizationId: null }],
        },
      }),
      this.prisma.asset.count({ where: { organizationId: orgId } }),
      this.prisma.liability.count({ where: { organizationId: orgId } }),
      this.prisma.expense.aggregate({
        where: { organizationId: orgId },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.sale.aggregate({
        where: { organizationId: orgId },
        _sum: {
          totalAmount: true,
          totalCost: true,
          grossProfit: true,
        },
        _count: true,
      }),
      this.prisma.purchase.aggregate({
        where: { organizationId: orgId },
        _sum: {
          totalAmount: true,
        },
        _count: true,
      }),
      this.prisma.product.findMany({
        where: { organizationId: orgId },
        include: { inventories: true },
      }),
      this.prisma.asset.findMany({
        where: { organizationId: orgId },
      }),
    ]);

    let inventoryValuation = 0;
    let lowStockCount = 0;

    for (const p of products) {
      const inv = p.inventories[0];
      const stock = inv ? Number(inv.quantity.toString()) : 0;
      const minStock = inv ? Number(inv.minStock.toString()) : 0;
      const cost = Number(p.averageCost.toString());

      inventoryValuation += stock * cost;
      if (stock <= minStock && minStock > 0) {
        lowStockCount++;
      }
    }

    let assetsValuation = 0;
    for (const a of assets) {
      assetsValuation += Number(a.currentValuation.toString());
    }

    const totalSales = Number((salesAgg._sum.totalAmount || 0).toString());
    const totalCostOfSales = Number((salesAgg._sum.totalCost || 0).toString());
    const grossProfit = Number((salesAgg._sum.grossProfit || 0).toString());
    const totalPurchases = Number(
      (purchasesAgg._sum.totalAmount || 0).toString(),
    );
    const totalExpenses = Number((expensesAgg._sum.amount || 0).toString());
    const netProfit = grossProfit - totalExpenses;
    const marginPercentage =
      totalSales > 0
        ? Number(((grossProfit / totalSales) * 100).toFixed(2))
        : 0;

    return {
      organization: {
        id: org.id,
        name: org.name,
        code: org.code,
        isPyme: org.isPyme,
      },
      kpis: {
        totalRevenue: Number(totalSales.toFixed(2)),
        totalCostOfSales: Number(totalCostOfSales.toFixed(2)),
        grossProfit: Number(grossProfit.toFixed(2)),
        totalExpenses: Number(totalExpenses.toFixed(2)),
        netProfit: Number(netProfit.toFixed(2)),
        profitMarginPercent: marginPercentage,
        totalPurchases: Number(totalPurchases.toFixed(2)),
        inventoryValuation: Number(inventoryValuation.toFixed(2)),
        assetsValuation: Number(assetsValuation.toFixed(2)),
      },
      counts: {
        productsCount,
        suppliersCount,
        customersCount,
        assetsCount,
        liabilitiesCount,
        expensesCount: expensesAgg._count,
        salesTransactionsCount: salesAgg._count,
        purchasesTransactionsCount: purchasesAgg._count,
        lowStockAlertsCount: lowStockCount,
      },
    };
  }
}
