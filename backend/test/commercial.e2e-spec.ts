/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { UserType, InstitutionStatus, OrganizationRole, Prisma, PaymentMethod } from '@prisma/client';

const Decimal = Prisma.Decimal;

describe('CommercialController (e2e)', () => {
  let app: INestApplication;

  let currentAuthUser: {
    id?: string;
    userId?: string;
    email?: string;
    institutionalPerson?: {
      id: string;
      userType: UserType;
      status: InstitutionStatus;
    };
    memberships?: Array<{
      organizationId: string;
      role: OrganizationRole;
      permissions?: string[];
    }>;
  } | null = null;

  const mockPrismaService = {
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'lock-ok' }]),
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
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Decimal(0) }, _count: 0 }),
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
      aggregate: jest.fn(),
    },
    sale: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    membership: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    ledgerAccount: {
      findUnique: jest.fn(({ where }) =>
        Promise.resolve({
          id: `acc-${where?.organizationId_code?.code || 'x'}`,
          organizationId: where?.organizationId_code?.organizationId,
          code: where?.organizationId_code?.code,
          name: where?.organizationId_code?.code,
          type: 'ASSET',
        }),
      ),
      findFirst: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(({ create }) =>
        Promise.resolve({
          id: `acc-${create.code}`,
          ...create,
        }),
      ),
    },
    studentAccount: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    institutionalPerson: {
      findUnique: jest.fn(),
    },
    transaction: {
      create: jest.fn(({ data }) =>
        Promise.resolve({
          id: `tx-${Date.now()}`,
          ...data,
          entries: [],
        }),
      ),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    ledgerEntry: {
      create: jest.fn(({ data }) =>
        Promise.resolve({ id: `le-${Date.now()}`, ...data }),
      ),
      createMany: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          req.user = currentAuthUser;
          return !!currentAuthUser;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaService.asset.count.mockResolvedValue(0);
    mockPrismaService.asset.findMany.mockResolvedValue([]);
    mockPrismaService.liability.count.mockResolvedValue(0);
    mockPrismaService.expense.aggregate.mockResolvedValue({ _sum: { amount: new Decimal(0) }, _count: 0 });
  });

  describe('1. Multi-Tenant Authorization & RBAC', () => {
    it('should reject access if user has no membership in organization (403 Forbidden)', async () => {
      currentAuthUser = {
        id: 'user-unauthorized',
        institutionalPerson: {
          id: 'person-1',
          userType: UserType.STUDENT,
          status: InstitutionStatus.ACTIVE,
        },
        memberships: [
          { organizationId: 'other-org', role: OrganizationRole.USER },
        ],
      };

      const response = await request(app.getHttpServer())
        .get('/organizations/org-target/commercial/products')
        .expect(403);

      expect(response.body.message).toContain('Access denied');
    });

    it('should allow access if user has active membership with required permissions', async () => {
      currentAuthUser = {
        id: 'manager-user',
        institutionalPerson: {
          id: 'person-manager',
          userType: UserType.STUDENT,
          status: InstitutionStatus.ACTIVE,
        },
        memberships: [
          {
            organizationId: 'org-agrored',
            role: OrganizationRole.USER,
            permissions: ['inventory.read'],
          },
        ],
      };

      mockPrismaService.product.count.mockResolvedValue(0);
      mockPrismaService.product.findMany.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get('/organizations/org-agrored/commercial/products')
        .expect(200);

      expect(response.body.data).toEqual([]);
    });
  });

  describe('2. Product & Inventory Management', () => {
    it('POST /organizations/:orgId/commercial/products - should create product with initial stock', async () => {
      currentAuthUser = {
        id: 'admin-user',
        institutionalPerson: {
          id: 'person-admin',
          userType: UserType.AUTHORITY,
          status: InstitutionStatus.ACTIVE,
        },
        memberships: [
          { organizationId: 'org-agrored', role: OrganizationRole.ADMIN },
        ],
      };

      mockPrismaService.product.findUnique.mockResolvedValue(null);
      mockPrismaService.product.create.mockResolvedValue({
        id: 'prod-lechuga',
        organizationId: 'org-agrored',
        sku: 'LECHUGA-HIDRO',
        name: 'Lechuga Hidropónica',
        category: 'Hortalizas',
        unit: 'UNIT',
        salePrice: new Decimal(0.85),
        averageCost: new Decimal(0.5),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrismaService.inventory.create.mockResolvedValue({
        id: 'inv-lechuga',
        productId: 'prod-lechuga',
        quantity: new Decimal(100),
        minStock: new Decimal(20),
        locationName: 'Bodega Principal',
      });

      const response = await request(app.getHttpServer())
        .post('/organizations/org-agrored/commercial/products')
        .send({
          sku: 'LECHUGA-HIDRO',
          name: 'Lechuga Hidropónica',
          category: 'Hortalizas',
          unit: 'UNIT',
          salePrice: 0.85,
          initialCost: 0.5,
          initialStock: 100,
          minStock: 20,
        })
        .expect(201);

      expect(response.body.id).toBe('prod-lechuga');
      expect(response.body.inventory.quantity).toBe(100);
      expect(mockPrismaService.inventoryMovement.create).toHaveBeenCalled();
    });
  });

  describe('3. Suppliers & Commercial Purchases', () => {
    it('POST /organizations/:orgId/commercial/purchases - should register purchase and recalculate WAC', async () => {
      currentAuthUser = {
        id: 'manager-user',
        institutionalPerson: {
          id: 'person-manager',
          userType: UserType.TEACHER,
          status: InstitutionStatus.ACTIVE,
        },
        memberships: [
          { organizationId: 'org-agrored', role: OrganizationRole.ADMIN },
        ],
      };

      mockPrismaService.supplier.findFirst.mockResolvedValue({
        id: 'sup-semillas',
        organizationId: 'org-agrored',
        name: 'Semillas del Valle',
        companyName: 'Semillas Valle Cía. Ltda.',
        taxId: '1799887766001',
        isActive: true,
        paymentTerms: 'CONTADO',
      });

      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([{ id: 'prod-lechuga', averageCost: new Decimal(0.5) }])
        .mockResolvedValueOnce([{ id: 'inv-lechuga', quantity: new Decimal(10) }]);

      mockPrismaService.purchase.create.mockResolvedValue({
        id: 'purch-001',
        organizationId: 'org-agrored',
        totalAmount: new Decimal(28.0),
        invoiceNumber: 'FAC-001-9988',
        status: 'RECEIVED',
        paymentTerms: 'CONTADO',
        supplier: { id: 'sup-semillas', name: 'Semillas del Valle', companyName: 'Semillas Valle Cía. Ltda.' },
        items: [
          {
            id: 'item-1',
            productId: 'prod-lechuga',
            product: { name: 'Lechuga', sku: 'LECHUGA-HIDRO' },
            quantity: new Decimal(40),
            unitCost: new Decimal(0.7),
            subtotal: new Decimal(28.0),
          },
        ],
        createdAt: new Date(),
      });

      const response = await request(app.getHttpServer())
        .post('/organizations/org-agrored/commercial/purchases')
        .send({
          supplierId: 'sup-semillas',
          invoiceNumber: 'FAC-001-9988',
          items: [{ productId: 'prod-lechuga', quantity: 40, unitCost: 0.7 }],
        })
        .expect(201);

      expect(response.body.id).toBe('purch-001');
      expect(response.body.totalAmount).toBe(28.0);
      expect(mockPrismaService.product.update).toHaveBeenCalled();
      expect(mockPrismaService.inventory.update).toHaveBeenCalled();
    });
  });

  describe('4. Customers & Point of Sale (POS) Sales', () => {
    it('POST /organizations/:orgId/commercial/sales - should complete POS checkout with student wallet', async () => {
      currentAuthUser = {
        id: 'cashier-user',
        institutionalPerson: {
          id: 'person-cashier',
          userType: UserType.STUDENT,
          status: InstitutionStatus.ACTIVE,
        },
        memberships: [
          {
            organizationId: 'org-agrored',
            role: OrganizationRole.USER,
            permissions: ['sales.create'],
          },
        ],
      };

      mockPrismaService.customer.findFirst.mockResolvedValue({
        id: 'cust-student',
        name: 'Camila Mora',
        isActive: true,
        institutionalPerson: {
          studentAccount: { id: 'acc-camila' },
        },
      });

      mockPrismaService.organization.findUnique.mockResolvedValue({
        id: 'org-agrored',
        name: 'AgroRed',
        code: 'AGRORED',
      });

      mockPrismaService.ledgerAccount.findUnique.mockResolvedValue({
        id: 'rev-agrored',
        code: 'AGRORED_REVENUE',
      });

      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([{ id: 'prod-lechuga', salePrice: new Decimal(0.85), averageCost: new Decimal(0.5) }])
        .mockResolvedValueOnce([{ id: 'inv-lechuga', quantity: new Decimal(50) }]);

      mockPrismaService.ledgerEntry.findMany.mockResolvedValue([
        { direction: 'CREDIT', amount: new Decimal(100.0) }, // Balance $100.00
      ]);

      mockPrismaService.transaction.create.mockResolvedValue({ id: 'tx-sale-1' });
      mockPrismaService.sale.create.mockResolvedValue({
        id: 'sale-001',
        organizationId: 'org-agrored',
        customer: { id: 'cust-student', name: 'Camila Mora', customerType: 'STUDENT' },
        totalAmount: new Decimal(3.4),
        totalCost: new Decimal(2.0),
        grossProfit: new Decimal(1.4),
        paymentMethod: PaymentMethod.STUDENT_ACCOUNT,
        status: 'COMPLETED',
        items: [
          {
            id: 'sitem-1',
            productId: 'prod-lechuga',
            product: { name: 'Lechuga', sku: 'LECHUGA-HIDRO' },
            quantity: new Decimal(4),
            unitPrice: new Decimal(0.85),
            unitCost: new Decimal(0.5),
            subtotal: new Decimal(3.4),
          },
        ],
        createdAt: new Date(),
      });

      const response = await request(app.getHttpServer())
        .post('/organizations/org-agrored/commercial/sales')
        .send({
          customerId: 'cust-student',
          paymentMethod: PaymentMethod.STUDENT_ACCOUNT,
          items: [{ productId: 'prod-lechuga', quantity: 4 }],
        })
        .expect(201);

      expect(response.body.id).toBe('sale-001');
      expect(response.body.grossProfit).toBe('1.40');
    });
  });

  describe('5. Commercial Summary / KPIs', () => {
    it('GET /organizations/:orgId/commercial/summary - should return aggregated KPIs', async () => {
      currentAuthUser = {
        id: 'admin-user',
        institutionalPerson: {
          id: 'person-admin',
          userType: UserType.AUTHORITY,
          status: InstitutionStatus.ACTIVE,
        },
        memberships: [
          { organizationId: 'org-agrored', role: OrganizationRole.ADMIN },
        ],
      };

      mockPrismaService.organization.findUnique.mockResolvedValue({
        id: 'org-agrored',
        name: 'AgroRed Surcos',
        code: 'AGRORED',
        isPyme: true,
      });

      mockPrismaService.product.count.mockResolvedValue(15);
      mockPrismaService.supplier.count.mockResolvedValue(4);
      mockPrismaService.customer.count.mockResolvedValue(120);
      mockPrismaService.sale.aggregate.mockResolvedValue({
        _sum: {
          totalAmount: new Decimal(1250.0),
          totalCost: new Decimal(800.0),
          grossProfit: new Decimal(450.0),
        },
        _count: 85,
      });
      mockPrismaService.purchase.aggregate.mockResolvedValue({
        _sum: { totalAmount: new Decimal(950.0) },
        _count: 12,
      });
      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockPrismaService.asset.count.mockResolvedValue(0);
      mockPrismaService.asset.findMany.mockResolvedValue([]);
      mockPrismaService.liability.count.mockResolvedValue(0);
      mockPrismaService.expense.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal(0) },
        _count: 0,
      });

      const response = await request(app.getHttpServer())
        .get('/organizations/org-agrored/commercial/summary')
        .expect(200);

      expect(response.body.kpis.totalRevenue).toBe(1250.0);
      expect(response.body.kpis.grossProfit).toBe(450.0);
      expect(response.body.kpis.profitMarginPercent).toBe(36.0);
      expect(response.body.counts.productsCount).toBe(15);
    });
  });
});
