import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { EntryDirection, MovementType, TransactionType, Prisma } from '@prisma/client';
const Decimal = Prisma.Decimal;

export interface RegisterSaleInput {
  organizationId: string;
  customerId: string;
  studentAccountId: string;
  revenueAccountId: string;
  actorId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}

@Injectable()
export class AgroredService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  /**
   * Registers a sale in AgroRed with:
   * 1. Concurrency locks on Products/Inventories (`FOR UPDATE`).
   * 2. Stock deduction & COGS calculation based on WAC.
   * 3. Student account balance verification.
   * 4. Atomic Double-Entry Ledger transaction.
   * 5. AuditLog entry.
   */
  async registerSale(input: RegisterSaleInput) {
    return this.prisma.$transaction(async (tx) => {
      let totalSaleAmount = new Decimal(0);
      let totalCogs = new Decimal(0);
      const saleItemData = [];

      for (const itemInput of input.items) {
        const qtyDecimal = new Decimal(itemInput.quantity);

        // Lock product row to prevent race conditions during WAC/Stock updates
        const products = await tx.$queryRaw<any[]>`
          SELECT id, "salePrice", "averageCost" 
          FROM "Product" 
          WHERE id = ${itemInput.productId} AND "organizationId" = ${input.organizationId} 
          FOR UPDATE
        `;

        if (!products || products.length === 0) {
          throw new BadRequestException(`Product ${itemInput.productId} not found in organization.`);
        }

        const product = products[0];
        const unitPrice = new Decimal(product.salePrice);
        const unitCost = new Decimal(product.averageCost);

        // Lock inventory row
        const inventories = await tx.$queryRaw<any[]>`
          SELECT id, quantity 
          FROM "Inventory" 
          WHERE "productId" = ${itemInput.productId} 
          FOR UPDATE
        `;

        if (!inventories || inventories.length === 0) {
          throw new BadRequestException(`Inventory for product ${itemInput.productId} not found.`);
        }

        const inventory = inventories[0];
        const currentStock = new Decimal(inventory.quantity);

        if (currentStock.lessThan(qtyDecimal)) {
          throw new ConflictException(`Insufficient stock for product ${itemInput.productId}. Available: ${currentStock.toString()}, Requested: ${qtyDecimal.toString()}`);
        }

        const newStock = currentStock.sub(qtyDecimal);
        const itemSubtotal = unitPrice.mul(qtyDecimal);
        const itemCostTotal = unitCost.mul(qtyDecimal);

        totalSaleAmount = totalSaleAmount.add(itemSubtotal);
        totalCogs = totalCogs.add(itemCostTotal);

        // Update inventory quantity
        await tx.inventory.update({
          where: { id: inventory.id },
          data: { quantity: newStock },
        });

        // Record InventoryMovement
        await tx.inventoryMovement.create({
          data: {
            productId: itemInput.productId,
            type: MovementType.SALE,
            quantity: qtyDecimal,
            unitCost: unitCost,
            previousStock: currentStock,
            newStock: newStock,
            actorId: input.actorId,
          },
        });

        saleItemData.push({
          productId: itemInput.productId,
          quantity: qtyDecimal,
          unitPrice,
          unitCost,
          subtotal: itemSubtotal,
        });
      }

      // Verify student account has sufficient balance
      const currentBalance = await this.ledgerService.getStudentAccountBalance(input.studentAccountId);
      if (currentBalance.lessThan(totalSaleAmount)) {
        throw new ConflictException(
          `Insufficient student account balance. Required: $${totalSaleAmount.toString()}, Available: $${currentBalance.toString()}`,
        );
      }

      const grossProfit = totalSaleAmount.sub(totalCogs);

      // Create Sale record
      const sale = await tx.sale.create({
        data: {
          organizationId: input.organizationId,
          customerId: input.customerId,
          actorId: input.actorId,
          totalAmount: totalSaleAmount,
          totalCost: totalCogs,
          grossProfit: grossProfit,
          items: {
            create: saleItemData,
          },
        },
      });

      // Post Double-Entry Ledger Transaction
      await this.ledgerService.createTransaction({
        type: TransactionType.PURCHASE,
        description: `AgroRed Sale #${sale.id}`,
        referenceType: 'SALE',
        referenceId: sale.id,
        actorId: input.actorId,
        entries: [
          {
            studentAccountId: input.studentAccountId,
            direction: EntryDirection.DEBIT, // Debit student account (decreases balance)
            amount: totalSaleAmount,
          },
          {
            ledgerAccountId: input.revenueAccountId,
            direction: EntryDirection.CREDIT, // Credit AgroRed revenue account
            amount: totalSaleAmount,
          },
        ],
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          organizationId: input.organizationId,
          action: 'REGISTER_SALE',
          entity: 'Sale',
          entityId: sale.id,
          newState: {
            totalAmount: totalSaleAmount.toString(),
            grossProfit: grossProfit.toString(),
            itemCount: input.items.length,
          },
        },
      });

      return sale;
    });
  }
}
