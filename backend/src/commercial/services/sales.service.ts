import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../../ledger/ledger.service';
import { CreateSaleDto, QuerySalesDto } from '../dto/sale.dto';
import { MoneyUtil } from '../../common/money';
import {
  AccountType,
  EntryDirection,
  MovementType,
  PaymentMethod,
  SaleStatus,
  TransactionType,
  AssetStatus,
  Prisma,
} from '@prisma/client';

const Decimal = Prisma.Decimal;

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  /**
   * Registers a commercial sale for Products or Assets (§8.5 PRD v1.0):
   * 1. Multi-item row-locking (`SELECT ... FOR UPDATE`) to prevent race conditions.
   * 2. Stock validation & deduction with InventoryMovement trail.
   * 3. Asset sale capability with status update to 'SOLD'.
   * 4. Exact COGS calculation using WAC at transaction time.
   * 5. Gross Profit derivation (Total - COGS).
   * 6. Double-Entry ledger posting (Debit Student Account or Cash / Credit PYME Revenue).
   * 7. AuditLog entry.
   */
  async createSale(orgId: string, dto: CreateSaleDto, actorId: string) {
    // 1. Verify customer
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: dto.customerId,
        OR: [{ organizationId: orgId }, { organizationId: null }],
      },
      include: {
        institutionalPerson: {
          include: { studentAccount: true },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(
        `Cliente con ID '${dto.customerId}' no encontrado en esta organización.`,
      );
    }

    if (!customer.isActive) {
      throw new BadRequestException('El perfil de cliente está inactivo.');
    }

    // 2. Fetch organization to resolve ledger accounts
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new NotFoundException(`Organización '${orgId}' no encontrada.`);
    }

    const paymentMethod = dto.paymentMethod || PaymentMethod.STUDENT_ACCOUNT;

    return this.prisma.$transaction(async (tx) => {
      let totalSaleAmount = new Decimal(0);
      let totalCogs = new Decimal(0);
      const saleItemData = [];

      // Ensure revenue account exists for this organization
      let revenueAccount = await tx.ledgerAccount.findUnique({
        where: {
          organizationId_code: {
            organizationId: orgId,
            code: `${org.code}_REVENUE`,
          },
        },
      });

      if (!revenueAccount) {
        revenueAccount = await tx.ledgerAccount.create({
          data: {
            organizationId: orgId,
            code: `${org.code}_REVENUE`,
            name: `${org.name} - Ingresos por Ventas`,
            type: AccountType.REVENUE,
          },
        });
      }

      for (const item of dto.items) {
        const qtyDecimal = new Decimal(item.quantity);

        if (qtyDecimal.lessThanOrEqualTo(0)) {
          throw new BadRequestException(
            'La cantidad de venta debe ser mayor a cero.',
          );
        }

        // Case A: Selling a Fixed Asset (§8.5 PRD v1.0)
        if (item.assetId) {
          const asset = await tx.asset.findFirst({
            where: { id: item.assetId, organizationId: orgId },
          });

          if (!asset) {
            throw new NotFoundException(
              `Activo con ID '${item.assetId}' no encontrado en esta organización.`,
            );
          }

          if (
            asset.status === AssetStatus.SOLD ||
            asset.status === AssetStatus.DISPOSED
          ) {
            throw new ConflictException(
              `El activo '${asset.name}' ya ha sido vendido o dado de baja.`,
            );
          }

          const unitPrice =
            item.unitPrice !== undefined
              ? new Decimal(item.unitPrice)
              : asset.salePrice || asset.currentValuation;
          const unitCost = asset.currentValuation || asset.acquisitionCost;

          const itemSubtotal = unitPrice.mul(qtyDecimal);
          const itemCogs = unitCost.mul(qtyDecimal);

          totalSaleAmount = totalSaleAmount.add(itemSubtotal);
          totalCogs = totalCogs.add(itemCogs);

          // Mark asset as SOLD
          await tx.asset.update({
            where: { id: asset.id },
            data: { status: AssetStatus.SOLD },
          });

          saleItemData.push({
            assetId: asset.id,
            quantity: qtyDecimal,
            unitPrice,
            unitCost,
            subtotal: itemSubtotal,
          });
        }
        // Case B: Selling regular inventory product
        else if (item.productId) {
          interface ProductRawRow {
            id: string;
            salePrice: Prisma.Decimal | number | string;
            averageCost: Prisma.Decimal | number | string;
          }

          interface InventoryRawRow {
            id: string;
            quantity: Prisma.Decimal | number | string;
          }

          // Lock product row to prevent concurrent price/cost mutations
          const products = await tx.$queryRaw<ProductRawRow[]>`
            SELECT id, "salePrice", "averageCost"
            FROM "Product"
            WHERE id = ${item.productId} AND "organizationId" = ${orgId}
            FOR UPDATE
          `;

          if (!products || products.length === 0) {
            throw new NotFoundException(
              `Producto con ID '${item.productId}' no encontrado en esta organización.`,
            );
          }

          const product = products[0];
          const unitPrice =
            item.unitPrice !== undefined
              ? new Decimal(item.unitPrice)
              : new Decimal(product.salePrice.toString());
          const unitCost = new Decimal(product.averageCost.toString());

          // Lock inventory row to prevent overselling
          const inventories = await tx.$queryRaw<InventoryRawRow[]>`
            SELECT id, quantity
            FROM "Inventory"
            WHERE "productId" = ${item.productId} AND "organizationId" = ${orgId}
            FOR UPDATE
          `;

          if (!inventories || inventories.length === 0) {
            throw new NotFoundException(
              `Inventario para el producto '${item.productId}' no encontrado en esta organización.`,
            );
          }

          const inventory = inventories[0];
          const currentStock = new Decimal(inventory.quantity.toString());

          if (currentStock.lessThan(qtyDecimal)) {
            throw new ConflictException(
              `Stock insuficiente para el producto ID '${item.productId}'. Disponible: ${currentStock.toString()}, Solicitado: ${qtyDecimal.toString()}`,
            );
          }

          const newStock = currentStock.sub(qtyDecimal);
          const itemSubtotal = unitPrice.mul(qtyDecimal);
          const itemCogs = unitCost.mul(qtyDecimal);

          totalSaleAmount = totalSaleAmount.add(itemSubtotal);
          totalCogs = totalCogs.add(itemCogs);

          // Update inventory quantity
          await tx.inventory.update({
            where: { id: inventory.id },
            data: { quantity: newStock },
          });

          // Record InventoryMovement
          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              type: MovementType.SALE,
              quantity: qtyDecimal,
              unitCost: unitCost,
              previousStock: currentStock,
              newStock: newStock,
              referenceId: dto.invoiceNumber
                ? dto.invoiceNumber.trim()
                : 'SALE',
              actorId,
            },
          });

          saleItemData.push({
            productId: item.productId,
            quantity: qtyDecimal,
            unitPrice,
            unitCost,
            subtotal: itemSubtotal,
          });
        } else {
          throw new BadRequestException(
            'Cada ítem de venta debe especificar un productId o un assetId.',
          );
        }
      }

      // Handle payment method and double-entry ledger transactions
      if (paymentMethod === PaymentMethod.STUDENT_ACCOUNT) {
        let resolvedStudentAccountId = dto.studentAccountId;

        if (
          !resolvedStudentAccountId &&
          customer.institutionalPerson?.studentAccount
        ) {
          resolvedStudentAccountId =
            customer.institutionalPerson.studentAccount.id;
        }

        if (!resolvedStudentAccountId) {
          throw new BadRequestException(
            'El cliente no cuenta con una cuenta de ahorro estudiantil vinculada para pago con STUDENT_ACCOUNT.',
          );
        }

        // Verificación de saldo bajo bloqueo de fila (evita doble gasto TOCTOU)
        await this.ledgerService.lockStudentAccount(
          resolvedStudentAccountId,
          tx,
        );

        const currentBalance =
          await this.ledgerService.getStudentAccountBalance(
            resolvedStudentAccountId,
            tx,
          );

        if (currentBalance.lessThan(totalSaleAmount)) {
          throw new ConflictException(
            `Saldo estudiantil insuficiente. Requerido: $${totalSaleAmount.toFixed(2)}, Disponible: $${currentBalance.toFixed(2)}`,
          );
        }

        // Double-entry transaction: Debit Student Account / Credit Revenue Account
        await this.ledgerService.createTransaction(
          {
            type: TransactionType.PURCHASE,
            description: `Compra en ${org.name} por ${customer.name || 'Estudiante'}`,
            referenceType: 'SALE',
            organizationId: orgId,
            actorId,
            entries: [
              {
                studentAccountId: resolvedStudentAccountId,
                direction: EntryDirection.DEBIT,
                amount: totalSaleAmount,
              },
              {
                ledgerAccountId: revenueAccount.id,
                direction: EntryDirection.CREDIT,
                amount: totalSaleAmount,
              },
            ],
          },
          tx,
        );
      } else {
        // Cash or external payment: Debit PYME Cash Vault / Credit Revenue Account
        let cashVault = await tx.ledgerAccount.findUnique({
          where: {
            organizationId_code: {
              organizationId: orgId,
              code: `${org.code}_CASH_VAULT`,
            },
          },
        });

        if (!cashVault) {
          cashVault = await tx.ledgerAccount.create({
            data: {
              organizationId: orgId,
              code: `${org.code}_CASH_VAULT`,
              name: `${org.name} - Caja / Efectivo`,
              type: AccountType.ASSET,
            },
          });
        }

        await this.ledgerService.createTransaction(
          {
            type: TransactionType.PURCHASE,
            description: `Venta al contado en ${org.name} a ${customer.name || 'Cliente Externo'}`,
            referenceType: 'SALE',
            organizationId: orgId,
            actorId,
            entries: [
              {
                ledgerAccountId: cashVault.id,
                direction: EntryDirection.DEBIT,
                amount: totalSaleAmount,
              },
              {
                ledgerAccountId: revenueAccount.id,
                direction: EntryDirection.CREDIT,
                amount: totalSaleAmount,
              },
            ],
          },
          tx,
        );
      }

      const grossProfit = totalSaleAmount.sub(totalCogs);

      // Create Sale record
      const sale = await tx.sale.create({
        data: {
          organizationId: orgId,
          customerId: customer.id,
          actorId,
          totalAmount: totalSaleAmount,
          totalCost: totalCogs,
          grossProfit,
          paymentMethod,
          status: SaleStatus.COMPLETED,
          invoiceNumber: dto.invoiceNumber ? dto.invoiceNumber.trim() : null,
          notes: dto.notes ? dto.notes.trim() : null,
          items: {
            create: saleItemData,
          },
        },
        include: {
          customer: true,
          items: {
            include: { product: true, asset: true },
          },
        },
      });

      // If physical inventory items were sold with cost, post COGS double-entry transaction: DEBIT COGS / CREDIT Inventory Asset
      if (totalCogs.greaterThan(0)) {
        const cogsAccount = await this.ledgerService.getOrganizationAccount(
          orgId,
          `${org.code}_COGS`,
          tx,
        );
        const inventoryAssetAccount =
          await this.ledgerService.getOrganizationAccount(
            orgId,
            `${org.code}_INVENTORY_ASSET`,
            tx,
          );

        await this.ledgerService.createTransaction(
          {
            type: TransactionType.COGS,
            description: `Costo de ventas (COGS) para factura ${sale.invoiceNumber || sale.id}`,
            referenceType: 'SALE',
            referenceId: sale.id,
            organizationId: orgId,
            actorId,
            entries: [
              {
                ledgerAccountId: cogsAccount.id,
                direction: EntryDirection.DEBIT,
                amount: totalCogs,
              },
              {
                ledgerAccountId: inventoryAssetAccount.id,
                direction: EntryDirection.CREDIT,
                amount: totalCogs,
              },
            ],
          },
          tx,
        );
      }

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId,
          organizationId: orgId,
          action: 'REGISTER_SALE',
          entity: 'Sale',
          entityId: sale.id,
          newState: {
            totalAmount: totalSaleAmount.toString(),
            grossProfit: grossProfit.toString(),
            totalCogs: totalCogs.toString(),
            paymentMethod,
            itemCount: dto.items.length,
          },
        },
      });

      return {
        id: sale.id,
        organizationId: sale.organizationId,
        customer: {
          id: sale.customer.id,
          name: sale.customer.name,
          email: sale.customer.email,
          customerType: sale.customer.customerType,
        },
        totalAmount: MoneyUtil.toString(sale.totalAmount),
        totalCost: MoneyUtil.toString(sale.totalCost),
        grossProfit: MoneyUtil.toString(sale.grossProfit),
        paymentMethod: sale.paymentMethod,
        status: sale.status,
        invoiceNumber: sale.invoiceNumber,
        notes: sale.notes,
        items: sale.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.product?.name || i.asset?.name || 'Ítem',
          sku: i.product?.sku || i.asset?.code || 'N/A',
          quantity: MoneyUtil.toString(i.quantity),
          unitPrice: MoneyUtil.toString(i.unitPrice),
          unitCost: MoneyUtil.toString(i.unitCost),
          subtotal: MoneyUtil.toString(i.subtotal),
        })),
        createdAt: sale.createdAt,
      };
    });
  }

  /**
   * Multi-tenant query for sales with totals.
   */
  async findAll(orgId: string, query: QuerySalesDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.SaleWhereInput = {
      organizationId: orgId,
    };

    if (query.customerId) {
      where.customerId = query.customerId;
    }

    if (query.paymentMethod) {
      where.paymentMethod = query.paymentMethod;
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

    const [total, sales] = await Promise.all([
      this.prisma.sale.count({ where }),
      this.prisma.sale.findMany({
        where,
        include: {
          customer: true,
          items: {
            include: { product: true, asset: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const formatted = sales.map((s) => ({
      id: s.id,
      organizationId: s.organizationId,
      customer: {
        id: s.customer.id,
        name: s.customer.name,
        email: s.customer.email,
        customerType: s.customer.customerType,
      },
      totalAmount: MoneyUtil.toString(s.totalAmount),
      totalCost: MoneyUtil.toString(s.totalCost),
      grossProfit: MoneyUtil.toString(s.grossProfit),
      paymentMethod: s.paymentMethod,
      status: s.status,
      invoiceNumber: s.invoiceNumber,
      itemCount: s.items.length,
      createdAt: s.createdAt,
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
   * Retrieves single sale with full itemized breakdown.
   */
  async findById(orgId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, organizationId: orgId },
      include: {
        customer: {
          include: { institutionalPerson: true },
        },
        items: {
          include: { product: true, asset: true },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException(
        `Venta con ID '${id}' no encontrada en esta organización.`,
      );
    }

    return {
      id: sale.id,
      organizationId: sale.organizationId,
      customer: {
        id: sale.customer.id,
        name:
          sale.customer.name ||
          (sale.customer.institutionalPerson
            ? `${sale.customer.institutionalPerson.firstName} ${sale.customer.institutionalPerson.lastName}`
            : 'Cliente'),
        email: sale.customer.email,
        customerType: sale.customer.customerType,
        taxId: sale.customer.taxId,
      },
      totalAmount: MoneyUtil.toString(sale.totalAmount),
      totalCost: MoneyUtil.toString(sale.totalCost),
      grossProfit: MoneyUtil.toString(sale.grossProfit),
      paymentMethod: sale.paymentMethod,
      status: sale.status,
      invoiceNumber: sale.invoiceNumber,
      notes: sale.notes,
      items: sale.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        assetId: i.assetId,
        productName: i.product?.name || i.asset?.name || 'Ítem',
        sku: i.product?.sku || i.asset?.code || 'N/A',
        unit: i.product?.unit || 'UNIT',
        quantity: MoneyUtil.toString(i.quantity),
        unitPrice: MoneyUtil.toString(i.unitPrice),
        unitCost: MoneyUtil.toString(i.unitCost),
        subtotal: MoneyUtil.toString(i.subtotal),
      })),
      createdAt: sale.createdAt,
      updatedAt: sale.updatedAt,
    };
  }

  /**
   * Cancels/Refunds a completed sale (§5.2, §18, §19 PRD v1.0).
   * Atomically:
   * 1. Reverses all associated ledger transactions (revenue, COGS, wallet deductions).
   * 2. Restores inventory stock with audit movements.
   * 3. Sets sale status to CANCELLED.
   */
  async cancelSale(
    orgId: string,
    saleId: string,
    reason: string,
    actorId: string,
  ) {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, organizationId: orgId },
      include: { items: true },
    });

    if (!sale) {
      throw new NotFoundException(
        `Venta con ID '${saleId}' no encontrada en esta organización.`,
      );
    }

    if (sale.status === SaleStatus.CANCELLED) {
      throw new BadRequestException('Esta venta ya fue anulada previamente.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Find all ledger transactions referencing this sale
      const transactions = await tx.transaction.findMany({
        where: { referenceType: 'SALE', referenceId: sale.id },
      });

      // 2. Reverse each ledger transaction
      for (const t of transactions) {
        await this.ledgerService.reverseTransaction(
          t.id,
          {
            reason: `Anulación de venta ${sale.invoiceNumber || sale.id}: ${reason}`,
          },
          actorId,
          tx,
        );
      }

      // 3. Restore inventory quantities and asset statuses
      for (const item of sale.items) {
        if (item.productId) {
          const inv = await tx.inventory.findFirst({
            where: { productId: item.productId, organizationId: orgId },
          });
          if (inv) {
            const currentQty = new Decimal(inv.quantity.toString());
            const newQty = currentQty.add(item.quantity);

            await tx.inventory.update({
              where: { id: inv.id },
              data: { quantity: newQty },
            });

            await tx.inventoryMovement.create({
              data: {
                productId: item.productId,
                type: MovementType.RETURN,
                quantity: item.quantity,
                unitCost: item.unitCost,
                previousStock: currentQty,
                newStock: newQty,
                referenceId: `CANCEL_SALE_${sale.id}`,
                actorId,
              },
            });
          }
        } else if (item.assetId) {
          await tx.asset.update({
            where: { id: item.assetId },
            data: { status: 'ACTIVE', isAvailableForSale: true },
          });
        }
      }

      // 4. Update sale status
      const updatedSale = await tx.sale.update({
        where: { id: sale.id },
        data: { status: SaleStatus.CANCELLED },
      });

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          actorId,
          organizationId: orgId,
          action: 'SALE_CANCELLED',
          entity: 'Sale',
          entityId: sale.id,
          previousState: { status: sale.status },
          newState: { status: SaleStatus.CANCELLED, reason },
        },
      });

      return {
        id: updatedSale.id,
        status: updatedSale.status,
        message:
          'Venta anulada y transacciones contables revertidas exitosamente.',
      };
    });
  }
}
