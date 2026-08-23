/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './services/products.service';
import { SuppliersService } from './services/suppliers.service';
import { CustomersService } from './services/customers.service';
import { PurchasesService } from './services/purchases.service';
import { SalesService } from './services/sales.service';
import { CommercialService } from './services/commercial.service';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, MovementType, PaymentMethod, UserType } from '@prisma/client';

const Decimal = Prisma.Decimal;

describe('Commercial Services (Unit Tests)', () => {
  let productsService: ProductsService;
  let suppliersService: SuppliersService;
  let customersService: CustomersService;
  let purchasesService: PurchasesService;
  let salesService: SalesService;
  let commercialService: CommercialService;
  let mockPrisma: any;
  let mockLedger: any;

  beforeEach(async () => {
    mockPrisma = {
      $transaction: jest.fn((callback) => callback(mockPrisma)),
      $queryRaw: jest.fn(),
      product: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      inventory: {
        create: jest.fn(),
        update: jest.fn(),
      },
      inventoryMovement: {
        create: jest.fn(),
      },
      asset: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      liability: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      expense: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { amount: 0 }, _count: 0 }),
      },
      supplier: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      customer: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      purchase: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { totalAmount: 0 }, _count: 0 }),
      },
      sale: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { totalAmount: 0, totalCost: 0, grossProfit: 0 },
          _count: 0,
        }),
      },
      organization: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      ledgerAccount: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      institutionalPerson: {
        findUnique: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
      },
      ledgerEntry: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    mockLedger = {
      getStudentAccountBalance: jest.fn(),
      createTransaction: jest.fn().mockResolvedValue({ id: 'tx-1' }),
      getOrganizationAccount: jest.fn().mockResolvedValue({ id: 'acc-1', code: 'REVENUE' }),
      ensureOrganizationAccounts: jest.fn().mockResolvedValue(undefined),
      reverseTransaction: jest.fn().mockResolvedValue({ id: 'rev-1' }),
      lockStudentAccount: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        SuppliersService,
        CustomersService,
        PurchasesService,
        SalesService,
        CommercialService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LedgerService, useValue: mockLedger },
      ],
    }).compile();

    productsService = module.get<ProductsService>(ProductsService);
    suppliersService = module.get<SuppliersService>(SuppliersService);
    customersService = module.get<CustomersService>(CustomersService);
    purchasesService = module.get<PurchasesService>(PurchasesService);
    salesService = module.get<SalesService>(SalesService);
    commercialService = module.get<CommercialService>(CommercialService);
  });

  describe('ProductsService', () => {
    it('should create product with initial stock and inventory movement', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      mockPrisma.product.create.mockResolvedValue({
        id: 'prod-1',
        organizationId: 'org-1',
        sku: 'HUEVOS-DOC',
        name: 'Huevos de Granja',
        salePrice: new Decimal(2.8),
        averageCost: new Decimal(2.0),
      });
      mockPrisma.inventory.create.mockResolvedValue({
        id: 'inv-1',
        productId: 'prod-1',
        quantity: new Decimal(50),
        minStock: new Decimal(10),
        locationName: 'Bodega Principal',
      });

      const result = await productsService.createProduct(
        'org-1',
        {
          sku: 'HUEVOS-DOC',
          name: 'Huevos de Granja',
          category: 'Alimentos',
          unit: 'DOZEN',
          salePrice: 2.8,
          initialCost: 2.0,
          initialStock: 50,
          minStock: 10,
        },
        'actor-1',
      );

      expect(result.id).toBe('prod-1');
      expect(result.inventory.quantity).toBe(50);
      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 'prod-1',
            type: MovementType.ADJUSTMENT,
          }),
        }),
      );
    });

    it('should reject creating duplicate SKU in same organization', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });

      await expect(
        productsService.createProduct(
          'org-1',
          {
            sku: 'EXISTING-SKU',
            name: 'Producto Existente',
            category: 'General',
            unit: 'UNIT',
            salePrice: 1.0,
          },
          'actor-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('SuppliersService', () => {
    it('should create external supplier without requiring institutional person', async () => {
      mockPrisma.supplier.findFirst.mockResolvedValue(null);
      mockPrisma.supplier.create.mockResolvedValue({
        id: 'sup-1',
        organizationId: 'org-1',
        name: 'Avícola Santa Marianita',
        companyName: 'Santa Marianita S.A.',
        taxId: '1790011223001',
        institutionalPersonId: null,
      });

      const result = await suppliersService.createSupplier(
        'org-1',
        {
          name: 'Avícola Santa Marianita',
          companyName: 'Santa Marianita S.A.',
          taxId: '1790011223001',
          paymentTerms: 'CREDITO_30',
        },
        'actor-1',
      );

      expect(result.id).toBe('sup-1');
      expect(result.institutionalPersonId).toBeNull();
    });

    it('should link supplier to existing InstitutionalPerson when provided', async () => {
      mockPrisma.supplier.findFirst.mockResolvedValue(null);
      mockPrisma.institutionalPerson.findUnique.mockResolvedValue({
        id: 'person-maestro',
        userType: UserType.TEACHER,
      });
      mockPrisma.supplier.create.mockResolvedValue({
        id: 'sup-2',
        organizationId: 'org-1',
        name: 'Ing. Carlos Benítez',
        institutionalPersonId: 'person-maestro',
      });

      const result = await suppliersService.createSupplier(
        'org-1',
        {
          name: 'Ing. Carlos Benítez',
          institutionalPersonId: 'person-maestro',
        },
        'actor-1',
      );

      expect(result.id).toBe('sup-2');
      expect(result.institutionalPersonId).toBe('person-maestro');
    });
  });

  describe('CustomersService', () => {
    it('should create external customer with no user account', async () => {
      mockPrisma.customer.create.mockResolvedValue({
        id: 'cust-ext-1',
        organizationId: 'org-1',
        name: 'Visitante Externo',
        taxId: '1712345678',
        customerType: 'EXTERNAL',
        institutionalPersonId: null,
      });

      const result = await customersService.createCustomer(
        'org-1',
        {
          name: 'Visitante Externo',
          taxId: '1712345678',
          customerType: 'EXTERNAL',
        },
        'actor-1',
      );

      expect(result.id).toBe('cust-ext-1');
      expect(result.customerType).toBe('EXTERNAL');
    });
  });

  describe('PurchasesService', () => {
    it('should recalculate Weighted Average Cost (WAC) correctly upon purchase', async () => {
      mockPrisma.supplier.findFirst.mockResolvedValue({
        id: 'sup-1',
        organizationId: 'org-1',
        isActive: true,
        paymentTerms: 'CONTADO',
      });

      // Existing product has 10 units at $2.00 WAC
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { id: 'prod-1', averageCost: new Decimal(2.0) },
        ])
        .mockResolvedValueOnce([{ id: 'inv-1', quantity: new Decimal(10.0) }]);

      // We purchase 10 units at $3.00
      // New WAC should be: ((10 * 2.00) + (10 * 3.00)) / 20 = $2.50
      mockPrisma.purchase.create.mockResolvedValue({
        id: 'purch-1',
        organizationId: 'org-1',
        totalAmount: new Decimal(30.0),
        supplier: { id: 'sup-1', name: 'Avícola Santa Marianita' },
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            product: { name: 'Huevos', sku: 'HUEVOS-DOC' },
            quantity: new Decimal(10),
            unitCost: new Decimal(3.0),
            subtotal: new Decimal(30.0),
          },
        ],
      });

      const result = await purchasesService.createPurchase(
        'org-1',
        {
          supplierId: 'sup-1',
          items: [{ productId: 'prod-1', quantity: 10, unitCost: 3.0 }],
        },
        'actor-1',
      );

      expect(result.id).toBe('purch-1');
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'prod-1' },
          data: { averageCost: new Decimal(2.5) },
        }),
      );
      expect(mockPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: { quantity: new Decimal(20) },
        }),
      );
    });
  });

  describe('SalesService', () => {
    it('should complete sale with row locking, deduct stock, calculate gross profit and debit student account', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'cust-1',
        name: 'Juan Pérez',
        isActive: true,
        institutionalPerson: {
          studentAccount: { id: 'acc-1' },
        },
      });

      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        name: 'AgroRed',
        code: 'AGRORED',
      });

      mockPrisma.ledgerAccount.findUnique.mockResolvedValue({
        id: 'rev-1',
        code: 'AGRORED_REVENUE',
      });

      // Product price $2.80, cost $2.00, stock 15 units
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          {
            id: 'prod-1',
            salePrice: new Decimal(2.8),
            averageCost: new Decimal(2.0),
          },
        ])
        .mockResolvedValueOnce([{ id: 'inv-1', quantity: new Decimal(15.0) }]);

      mockLedger.getStudentAccountBalance.mockResolvedValue(new Decimal(50.0));

      mockPrisma.sale.create.mockResolvedValue({
        id: 'sale-1',
        organizationId: 'org-1',
        customer: { id: 'cust-1', name: 'Juan Pérez' },
        totalAmount: new Decimal(5.6),
        totalCost: new Decimal(4.0),
        grossProfit: new Decimal(1.6),
        paymentMethod: PaymentMethod.STUDENT_ACCOUNT,
        status: 'COMPLETED',
        items: [
          {
            id: 'sitem-1',
            productId: 'prod-1',
            product: { name: 'Huevos', sku: 'HUEVOS-DOC' },
            quantity: new Decimal(2),
            unitPrice: new Decimal(2.8),
            unitCost: new Decimal(2.0),
            subtotal: new Decimal(5.6),
          },
        ],
      });

      const result = await salesService.createSale(
        'org-1',
        {
          customerId: 'cust-1',
          paymentMethod: PaymentMethod.STUDENT_ACCOUNT,
          items: [{ productId: 'prod-1', quantity: 2 }],
        },
        'cashier-1',
      );

      expect(result.id).toBe('sale-1');
      expect(result.grossProfit).toBe('1.60');
      expect(mockPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: { quantity: new Decimal(13) },
        }),
      );
      expect(mockLedger.createTransaction).toHaveBeenCalled();
    });

    it('should reject sale if product inventory is insufficient', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'cust-1',
        isActive: true,
        institutionalPerson: { studentAccount: { id: 'acc-1' } },
      });
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        code: 'AGRORED',
      });
      mockPrisma.ledgerAccount.findUnique.mockResolvedValue({ id: 'rev-1' });

      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          {
            id: 'prod-1',
            salePrice: new Decimal(2.8),
            averageCost: new Decimal(2.0),
          },
        ])
        .mockResolvedValueOnce([{ id: 'inv-1', quantity: new Decimal(1.0) }]); // Only 1 in stock

      await expect(
        salesService.createSale(
          'org-1',
          {
            customerId: 'cust-1',
            paymentMethod: PaymentMethod.STUDENT_ACCOUNT,
            items: [{ productId: 'prod-1', quantity: 5 }], // Request 5
          },
          'cashier-1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject sale if student wallet balance is insufficient', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'cust-1',
        isActive: true,
        institutionalPerson: { studentAccount: { id: 'acc-1' } },
      });
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        code: 'AGRORED',
      });
      mockPrisma.ledgerAccount.findUnique.mockResolvedValue({ id: 'rev-1' });

      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          {
            id: 'prod-1',
            salePrice: new Decimal(10.0),
            averageCost: new Decimal(5.0),
          },
        ])
        .mockResolvedValueOnce([{ id: 'inv-1', quantity: new Decimal(20.0) }]);

      mockLedger.getStudentAccountBalance.mockResolvedValue(new Decimal(5.0)); // Has only $5.00, item costs $10.00

      await expect(
        salesService.createSale(
          'org-1',
          {
            customerId: 'cust-1',
            paymentMethod: PaymentMethod.STUDENT_ACCOUNT,
            items: [{ productId: 'prod-1', quantity: 1 }],
          },
          'cashier-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });
});
