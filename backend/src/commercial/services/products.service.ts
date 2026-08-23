import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateProductDto,
  UpdateProductDto,
  AdjustInventoryDto,
  QueryProductsDto,
} from '../dto/product.dto';
import {
  ProductType,
  ProductStatus,
  MovementType,
  Prisma,
} from '@prisma/client';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a product in the given organization with initial stock & inventory initialization.
   */
  async createProduct(orgId: string, dto: CreateProductDto, actorId: string) {
    const normalizedSku = dto.sku.trim().toUpperCase();

    // Check SKU uniqueness within organization
    const existing = await this.prisma.product.findUnique({
      where: {
        organizationId_sku: {
          organizationId: orgId,
          sku: normalizedSku,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Product with SKU '${dto.sku}' already exists in this organization.`,
      );
    }

    const salePriceDecimal = new Decimal(dto.salePrice);
    const initialCostDecimal = new Decimal(dto.initialCost || 0);
    const initialStockDecimal = new Decimal(dto.initialStock || 0);
    const minStockDecimal = new Decimal(dto.minStock || 0);

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Product
      const product = await tx.product.create({
        data: {
          organizationId: orgId,
          sku: normalizedSku,
          name: dto.name.trim(),
          description: dto.description ? dto.description.trim() : null,
          category: dto.category.trim(),
          unit: dto.unit.trim().toUpperCase(),
          type: dto.type || ProductType.PRODUCT,
          status: ProductStatus.ACTIVE,
          salePrice: salePriceDecimal,
          averageCost: initialCostDecimal,
        },
      });

      // 2. Initialize Inventory location
      const inventory = await tx.inventory.create({
        data: {
          organizationId: orgId,
          productId: product.id,
          locationName: 'Bodega Principal',
          quantity: initialStockDecimal,
          minStock: minStockDecimal,
        },
      });

      // 3. Record initial inventory movement if stock > 0
      if (initialStockDecimal.greaterThan(0)) {
        await tx.inventoryMovement.create({
          data: {
            productId: product.id,
            type: MovementType.ADJUSTMENT,
            quantity: initialStockDecimal,
            unitCost: initialCostDecimal,
            previousStock: new Decimal(0),
            newStock: initialStockDecimal,
            referenceId: 'INITIAL_STOCK',
            actorId,
          },
        });
      }

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          actorId,
          organizationId: orgId,
          action: 'CREATE_PRODUCT',
          entity: 'Product',
          entityId: product.id,
          newState: {
            sku: product.sku,
            name: product.name,
            salePrice: product.salePrice.toString(),
            averageCost: product.averageCost.toString(),
            initialStock: initialStockDecimal.toString(),
          },
        },
      });

      return {
        ...product,
        inventory: {
          quantity: Number(inventory.quantity.toFixed(2)),
          minStock: Number(inventory.minStock.toFixed(2)),
          locationName: inventory.locationName,
        },
      };
    });
  }

  /**
   * Multi-tenant query for products with stock levels.
   */
  async findAll(orgId: string, query: QueryProductsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      organizationId: orgId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.category) {
      where.category = { contains: query.category, mode: 'insensitive' };
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: {
          inventories: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const formatted = products.map((p) => {
      const mainInventory = p.inventories[0];
      const stock = mainInventory
        ? Number(mainInventory.quantity.toFixed(2))
        : 0;
      const minStock = mainInventory
        ? Number(mainInventory.minStock.toFixed(2))
        : 0;
      const isLowStock = stock <= minStock && minStock > 0;

      return {
        id: p.id,
        organizationId: p.organizationId,
        sku: p.sku,
        name: p.name,
        description: p.description,
        category: p.category,
        unit: p.unit,
        type: p.type,
        status: p.status,
        salePrice: Number(p.salePrice.toFixed(2)),
        averageCost: Number(p.averageCost.toFixed(2)),
        stock,
        minStock,
        isLowStock,
        inventoryValuation: Number(p.averageCost.mul(stock).toFixed(2)),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    });

    return {
      data: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves single product details with inventory movements history.
   */
  async findById(orgId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId: orgId },
      include: {
        inventories: true,
        inventoryMovements: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!product) {
      throw new NotFoundException(
        `Product with ID '${id}' not found in organization.`,
      );
    }

    const mainInventory = product.inventories[0];
    const stock = mainInventory ? Number(mainInventory.quantity.toFixed(2)) : 0;
    const minStock = mainInventory
      ? Number(mainInventory.minStock.toFixed(2))
      : 0;

    return {
      id: product.id,
      organizationId: product.organizationId,
      sku: product.sku,
      name: product.name,
      description: product.description,
      category: product.category,
      unit: product.unit,
      type: product.type,
      status: product.status,
      salePrice: Number(product.salePrice.toFixed(2)),
      averageCost: Number(product.averageCost.toFixed(2)),
      stock,
      minStock,
      isLowStock: stock <= minStock && minStock > 0,
      inventoryValuation: Number(product.averageCost.mul(stock).toFixed(2)),
      movements: product.inventoryMovements.map((m) => ({
        id: m.id,
        type: m.type,
        quantity: Number(m.quantity.toFixed(2)),
        unitCost: Number(m.unitCost.toFixed(2)),
        previousStock: Number(m.previousStock.toFixed(2)),
        newStock: Number(m.newStock.toFixed(2)),
        referenceId: m.referenceId,
        actorId: m.actorId,
        createdAt: m.createdAt,
      })),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  /**
   * Updates product metadata safely.
   */
  async updateProduct(
    orgId: string,
    id: string,
    dto: UpdateProductDto,
    actorId: string,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId: orgId },
      include: { inventories: true },
    });

    if (!product) {
      throw new NotFoundException(
        `Product with ID '${id}' not found in organization.`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const p = await tx.product.update({
        where: { id },
        data: {
          name: dto.name ? dto.name.trim() : undefined,
          description:
            dto.description !== undefined ? dto.description?.trim() : undefined,
          category: dto.category ? dto.category.trim() : undefined,
          unit: dto.unit ? dto.unit.trim().toUpperCase() : undefined,
          status: dto.status || undefined,
          salePrice: dto.salePrice ? new Decimal(dto.salePrice) : undefined,
        },
      });

      if (dto.minStock !== undefined && product.inventories.length > 0) {
        await tx.inventory.update({
          where: { id: product.inventories[0].id },
          data: { minStock: new Decimal(dto.minStock) },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId,
          organizationId: orgId,
          action: 'UPDATE_PRODUCT',
          entity: 'Product',
          entityId: id,
          previousState: {
            name: product.name,
            salePrice: product.salePrice.toString(),
            status: product.status,
          },
          newState: { ...dto },
        },
      });

      return p;
    });

    return this.findById(orgId, updated.id);
  }

  /**
   * Manually adjusts inventory stock with audit movement trail.
   */
  async adjustInventory(
    orgId: string,
    dto: AdjustInventoryDto,
    actorId: string,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, organizationId: orgId },
      include: { inventories: true },
    });

    if (!product) {
      throw new NotFoundException(
        `Product with ID '${dto.productId}' not found in organization.`,
      );
    }

    const inventory = product.inventories[0];
    if (!inventory) {
      throw new NotFoundException(`Inventory record not found for product.`);
    }

    const qtyDelta = new Decimal(dto.quantity);
    const currentStock = inventory.quantity;
    const newStock = currentStock.add(qtyDelta);

    if (newStock.lessThan(0)) {
      throw new BadRequestException(
        `Adjustment would cause negative inventory stock. Current: ${currentStock.toString()}, Delta: ${qtyDelta.toString()}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Update inventory
      await tx.inventory.update({
        where: { id: inventory.id },
        data: { quantity: newStock },
      });

      // Record movement
      await tx.inventoryMovement.create({
        data: {
          productId: product.id,
          type: dto.type || MovementType.ADJUSTMENT,
          quantity: qtyDelta.abs(),
          unitCost: product.averageCost,
          previousStock: currentStock,
          newStock: newStock,
          referenceId: dto.reason ? dto.reason.trim() : 'MANUAL_ADJUSTMENT',
          actorId,
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId,
          organizationId: orgId,
          action: 'ADJUST_INVENTORY',
          entity: 'Inventory',
          entityId: inventory.id,
          previousState: { quantity: currentStock.toString() },
          newState: {
            quantity: newStock.toString(),
            delta: qtyDelta.toString(),
            reason: dto.reason,
          },
        },
      });

      return {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        previousStock: Number(currentStock.toFixed(2)),
        newStock: Number(newStock.toFixed(2)),
        delta: Number(qtyDelta.toFixed(2)),
      };
    });
  }
}
