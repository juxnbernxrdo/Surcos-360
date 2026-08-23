import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../../ledger/ledger.service';
import { CreatePurchaseDto, QueryPurchasesDto } from '../dto/purchase.dto';
import {
  MovementType,
  PurchaseStatus,
  TransactionType,
  EntryDirection,
  Prisma,
} from '@prisma/client';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  /**
   * Registers a commercial purchase with atomic Weighted Average Cost (WAC) recalculation,
   * inventory increment, and double-entry consistency.
   */
  async createPurchase(orgId: string, dto: CreatePurchaseDto, actorId: string) {
    // 1. Verify supplier belongs to this organization
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, organizationId: orgId },
    });

    if (!supplier) {
      throw new NotFoundException(
        `Supplier with ID '${dto.supplierId}' not found in this organization.`,
      );
    }

    if (!supplier.isActive) {
      throw new BadRequestException(
        'Cannot purchase from an inactive supplier.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      let totalPurchaseAmount = new Decimal(0);
      const purchaseItemData = [];

      for (const item of dto.items) {
        const qtyDecimal = new Decimal(item.quantity);
        const costDecimal = new Decimal(item.unitCost);

        if (
          qtyDecimal.lessThanOrEqualTo(0) ||
          costDecimal.lessThanOrEqualTo(0)
        ) {
          throw new BadRequestException(
            'Quantity and unit cost must be greater than zero.',
          );
        }

        interface ProductRawRow {
          id: string;
          averageCost: Prisma.Decimal | number | string;
        }

        interface InventoryRawRow {
          id: string;
          quantity: Prisma.Decimal | number | string;
        }

        // Lock product row to prevent race conditions during WAC calculation
        const products = await tx.$queryRaw<ProductRawRow[]>`
          SELECT id, "averageCost"
          FROM "Product"
          WHERE id = ${item.productId} AND "organizationId" = ${orgId}
          FOR UPDATE
        `;

        if (!products || products.length === 0) {
          throw new NotFoundException(
            `Product with ID '${item.productId}' not found in this organization.`,
          );
        }

        const product = products[0];
        const oldWac = new Decimal(product.averageCost.toString());

        // Lock inventory row
        const inventories = await tx.$queryRaw<InventoryRawRow[]>`
          SELECT id, quantity
          FROM "Inventory"
          WHERE "productId" = ${item.productId} AND "organizationId" = ${orgId}
          FOR UPDATE
        `;

        if (!inventories || inventories.length === 0) {
          throw new NotFoundException(
            `Inventory for product '${item.productId}' not found in organization.`,
          );
        }

        const inventory = inventories[0];
        const currentStock = new Decimal(inventory.quantity.toString());

        // Weighted Average Cost formula:
        // newWac = ((currentStock * oldWac) + (qty * cost)) / (currentStock + qty)
        const totalOldCost = currentStock.mul(oldWac);
        const totalNewCost = qtyDecimal.mul(costDecimal);
        const newTotalStock = currentStock.add(qtyDecimal);

        let newWac = costDecimal;
        if (newTotalStock.greaterThan(0)) {
          newWac = totalOldCost.add(totalNewCost).div(newTotalStock);
        }

        const itemSubtotal = qtyDecimal.mul(costDecimal);
        totalPurchaseAmount = totalPurchaseAmount.add(itemSubtotal);

        // Update product WAC
        await tx.product.update({
          where: { id: item.productId },
          data: { averageCost: newWac },
        });

        // Update inventory quantity
        await tx.inventory.update({
          where: { id: inventory.id },
          data: { quantity: newTotalStock },
        });

        // Record InventoryMovement
        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            type: MovementType.PURCHASE,
            quantity: qtyDecimal,
            unitCost: costDecimal,
            previousStock: currentStock,
            newStock: newTotalStock,
            referenceId: dto.invoiceNumber
              ? dto.invoiceNumber.trim()
              : 'PURCHASE',
            actorId,
          },
        });

        purchaseItemData.push({
          productId: item.productId,
          quantity: qtyDecimal,
          unitCost: costDecimal,
          subtotal: itemSubtotal,
        });
      }

      // Create Purchase record
      const purchase = await tx.purchase.create({
        data: {
          organizationId: orgId,
          supplierId: dto.supplierId,
          actorId,
          totalAmount: totalPurchaseAmount,
          invoiceNumber: dto.invoiceNumber ? dto.invoiceNumber.trim() : null,
          paymentTerms: dto.paymentTerms
            ? dto.paymentTerms.trim()
            : supplier.paymentTerms,
          notes: dto.notes ? dto.notes.trim() : null,
          status: PurchaseStatus.RECEIVED,
          items: {
            create: purchaseItemData,
          },
        },
        include: {
          supplier: true,
          items: {
            include: { product: true },
          },
        },
      });

      // Post double-entry transaction: DEBIT Inventory Asset / CREDIT Accounts Payable (or Cash Vault)
      const org = await tx.organization.findUnique({
        where: { id: orgId },
      });
      const orgCode = org?.code || 'ORG';

      const inventoryAssetAccount =
        await this.ledgerService.getOrganizationAccount(
          orgId,
          `${orgCode}_INVENTORY_ASSET`,
          tx,
        );
      const accountsPayable = await this.ledgerService.getOrganizationAccount(
        orgId,
        `${orgCode}_ACCOUNTS_PAYABLE`,
        tx,
      );

      await this.ledgerService.createTransaction(
        {
          type: TransactionType.PURCHASE,
          description: `Compra a proveedor ${supplier.name} - Factura ${purchase.invoiceNumber || 'S/N'}`,
          referenceType: 'PURCHASE',
          referenceId: purchase.id,
          organizationId: orgId,
          actorId,
          entries: [
            {
              ledgerAccountId: inventoryAssetAccount.id,
              direction: EntryDirection.DEBIT,
              amount: totalPurchaseAmount,
            },
            {
              ledgerAccountId: accountsPayable.id,
              direction: EntryDirection.CREDIT,
              amount: totalPurchaseAmount,
            },
          ],
        },
        tx,
      );

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId,
          organizationId: orgId,
          action: 'REGISTER_PURCHASE',
          entity: 'Purchase',
          entityId: purchase.id,
          newState: {
            totalAmount: totalPurchaseAmount.toString(),
            supplierId: dto.supplierId,
            itemCount: dto.items.length,
            invoiceNumber: purchase.invoiceNumber,
          },
        },
      });

      return {
        id: purchase.id,
        organizationId: purchase.organizationId,
        supplier: {
          id: purchase.supplier.id,
          name: purchase.supplier.name,
          companyName: purchase.supplier.companyName,
          taxId: purchase.supplier.taxId,
        },
        totalAmount: Number(purchase.totalAmount.toFixed(2)),
        invoiceNumber: purchase.invoiceNumber,
        status: purchase.status,
        paymentTerms: purchase.paymentTerms,
        notes: purchase.notes,
        items: purchase.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.product.name,
          sku: i.product.sku,
          quantity: Number(i.quantity.toFixed(2)),
          unitCost: Number(i.unitCost.toFixed(2)),
          subtotal: Number(i.subtotal.toFixed(2)),
        })),
        createdAt: purchase.createdAt,
      };
    });
  }

  /**
   * Multi-tenant query for purchases.
   */
  async findAll(orgId: string, query: QueryPurchasesDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseWhereInput = {
      organizationId: orgId,
    };

    if (query.supplierId) {
      where.supplierId = query.supplierId;
    }

    if (query.status) {
      where.status = query.status;
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

    const [total, purchases] = await Promise.all([
      this.prisma.purchase.count({ where }),
      this.prisma.purchase.findMany({
        where,
        include: {
          supplier: true,
          items: {
            include: { product: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const formatted = purchases.map((p) => ({
      id: p.id,
      organizationId: p.organizationId,
      supplier: {
        id: p.supplier.id,
        name: p.supplier.name,
        companyName: p.supplier.companyName,
        taxId: p.supplier.taxId,
      },
      totalAmount: Number(p.totalAmount.toFixed(2)),
      invoiceNumber: p.invoiceNumber,
      status: p.status,
      paymentTerms: p.paymentTerms,
      notes: p.notes,
      itemCount: p.items.length,
      createdAt: p.createdAt,
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
   * Retrieves single purchase with all items and recalculations.
   */
  async findById(orgId: string, id: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, organizationId: orgId },
      include: {
        supplier: true,
        items: {
          include: { product: true },
        },
      },
    });

    if (!purchase) {
      throw new NotFoundException(
        `Purchase with ID '${id}' not found in this organization.`,
      );
    }

    return {
      id: purchase.id,
      organizationId: purchase.organizationId,
      supplier: {
        id: purchase.supplier.id,
        name: purchase.supplier.name,
        companyName: purchase.supplier.companyName,
        taxId: purchase.supplier.taxId,
        email: purchase.supplier.email,
        phone: purchase.supplier.phone,
      },
      totalAmount: Number(purchase.totalAmount.toFixed(2)),
      invoiceNumber: purchase.invoiceNumber,
      status: purchase.status,
      paymentTerms: purchase.paymentTerms,
      notes: purchase.notes,
      items: purchase.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.product.name,
        sku: i.product.sku,
        unit: i.product.unit,
        quantity: Number(i.quantity.toFixed(2)),
        unitCost: Number(i.unitCost.toFixed(2)),
        subtotal: Number(i.subtotal.toFixed(2)),
      })),
      createdAt: purchase.createdAt,
      updatedAt: purchase.updatedAt,
    };
  }
}
