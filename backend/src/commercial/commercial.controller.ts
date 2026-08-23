import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProductsService } from './services/products.service';
import { SuppliersService } from './services/suppliers.service';
import { CustomersService } from './services/customers.service';
import { PurchasesService } from './services/purchases.service';
import { SalesService } from './services/sales.service';
import { CommercialService } from './services/commercial.service';
import { AssetsService } from './services/assets.service';
import { LiabilitiesService } from './services/liabilities.service';
import { ExpensesService } from './services/expenses.service';
import { GymService } from './services/gym.service';
import { RentalsService } from './services/rentals.service';
import {
  CreateProductDto,
  UpdateProductDto,
  AdjustInventoryDto,
  QueryProductsDto,
} from './dto/product.dto';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  QuerySuppliersDto,
} from './dto/supplier.dto';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  QueryCustomersDto,
} from './dto/customer.dto';
import { CreatePurchaseDto, QueryPurchasesDto } from './dto/purchase.dto';
import { CreateSaleDto, QuerySalesDto } from './dto/sale.dto';
import {
  CreateAssetDto,
  UpdateAssetDto,
  QueryAssetsDto,
} from './dto/asset.dto';
import {
  CreateLiabilityDto,
  UpdateLiabilityDto,
  QueryLiabilitiesDto,
} from './dto/liability.dto';
import { CreateExpenseDto, QueryExpensesDto } from './dto/expense.dto';
import { CreateGymVisitDto, QueryGymVisitsDto } from './dto/gym-visit.dto';
import {
  CreateRentalDto,
  ReturnRentalDto,
  QueryRentalsDto,
} from './dto/rental.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrgPermissionsGuard } from '../auth/guards/org-permissions.guard';
import { OrgPermissions } from '../auth/decorators/org-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OrganizationRole } from '@prisma/client';

@Controller('organizations/:orgId/commercial')
@UseGuards(JwtAuthGuard, RolesGuard, OrgPermissionsGuard)
export class CommercialController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly suppliersService: SuppliersService,
    private readonly customersService: CustomersService,
    private readonly purchasesService: PurchasesService,
    private readonly salesService: SalesService,
    private readonly commercialService: CommercialService,
    private readonly assetsService: AssetsService,
    private readonly liabilitiesService: LiabilitiesService,
    private readonly expensesService: ExpensesService,
    private readonly gymService: GymService,
    private readonly rentalsService: RentalsService,
  ) {}

  // ----------------------------------------------------
  // COMMERCIAL KPIS & DASHBOARD (§8 PRD v1.0)
  // ----------------------------------------------------
  @Get('summary')
  @OrgPermissions('reports.read', OrganizationRole.ADMIN, OrganizationRole.USER)
  async getSummary(@Param('orgId') orgId: string) {
    return this.commercialService.getCommercialSummary(orgId);
  }

  // ----------------------------------------------------
  // PRODUCTS & INVENTORY
  // ----------------------------------------------------
  @Post('products')
  @OrgPermissions('inventory.create', OrganizationRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createProduct(
    @Param('orgId') orgId: string,
    @Body() dto: CreateProductDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.productsService.createProduct(orgId, dto, actorId);
  }

  @Get('products')
  @OrgPermissions(
    'inventory.read',
    OrganizationRole.ADMIN,
    OrganizationRole.USER,
  )
  async findAllProducts(
    @Param('orgId') orgId: string,
    @Query() query: QueryProductsDto,
  ) {
    return this.productsService.findAll(orgId, query);
  }

  @Get('products/:id')
  @OrgPermissions(
    'inventory.read',
    OrganizationRole.ADMIN,
    OrganizationRole.USER,
  )
  async findProductById(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.productsService.findById(orgId, id);
  }

  @Patch('products/:id')
  @OrgPermissions('inventory.update', OrganizationRole.ADMIN)
  async updateProduct(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.productsService.updateProduct(orgId, id, dto, actorId);
  }

  @Post('inventory/adjust')
  @OrgPermissions('inventory.adjust', OrganizationRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async adjustInventory(
    @Param('orgId') orgId: string,
    @Body() dto: AdjustInventoryDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.productsService.adjustInventory(orgId, dto, actorId);
  }

  // ----------------------------------------------------
  // ASSETS (ACTIVOS PATRIMONIALES §8.1)
  // ----------------------------------------------------
  @Post('assets')
  @OrgPermissions('assets.manage', OrganizationRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createAsset(
    @Param('orgId') orgId: string,
    @Body() dto: CreateAssetDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.assetsService.createAsset(orgId, dto, actorId);
  }

  @Get('assets')
  @OrgPermissions('assets.read', OrganizationRole.ADMIN, OrganizationRole.USER)
  async findAllAssets(
    @Param('orgId') orgId: string,
    @Query() query: QueryAssetsDto,
  ) {
    return this.assetsService.findAll(orgId, query);
  }

  @Get('assets/:id')
  @OrgPermissions('assets.read', OrganizationRole.ADMIN, OrganizationRole.USER)
  async findAssetById(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.assetsService.findById(orgId, id);
  }

  @Patch('assets/:id')
  @OrgPermissions('assets.manage', OrganizationRole.ADMIN)
  async updateAsset(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAssetDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.assetsService.updateAsset(orgId, id, dto, actorId);
  }

  // ----------------------------------------------------
  // LIABILITIES (PASIVOS Y DEUDAS §8.1)
  // ----------------------------------------------------
  @Post('liabilities')
  @OrgPermissions('liabilities.manage', OrganizationRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createLiability(
    @Param('orgId') orgId: string,
    @Body() dto: CreateLiabilityDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.liabilitiesService.createLiability(orgId, dto, actorId);
  }

  @Get('liabilities')
  @OrgPermissions(
    'liabilities.read',
    OrganizationRole.ADMIN,
    OrganizationRole.USER,
  )
  async findAllLiabilities(
    @Param('orgId') orgId: string,
    @Query() query: QueryLiabilitiesDto,
  ) {
    return this.liabilitiesService.findAll(orgId, query);
  }

  @Get('liabilities/:id')
  @OrgPermissions(
    'liabilities.read',
    OrganizationRole.ADMIN,
    OrganizationRole.USER,
  )
  async findLiabilityById(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.liabilitiesService.findById(orgId, id);
  }

  @Patch('liabilities/:id')
  @OrgPermissions('liabilities.manage', OrganizationRole.ADMIN)
  async updateLiability(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLiabilityDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.liabilitiesService.updateLiability(orgId, id, dto, actorId);
  }

  // ----------------------------------------------------
  // EXPENSES (GASTOS OPERATIVOS)
  // ----------------------------------------------------
  @Post('expenses')
  @OrgPermissions('expenses.create', OrganizationRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createExpense(
    @Param('orgId') orgId: string,
    @Body() dto: CreateExpenseDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.expensesService.createExpense(orgId, dto, actorId);
  }

  @Get('expenses')
  @OrgPermissions(
    'expenses.read',
    OrganizationRole.ADMIN,
    OrganizationRole.USER,
  )
  async findAllExpenses(
    @Param('orgId') orgId: string,
    @Query() query: QueryExpensesDto,
  ) {
    return this.expensesService.findAll(orgId, query);
  }

  // ----------------------------------------------------
  // SUPPLIERS (PROVEEDORES)
  // ----------------------------------------------------
  @Post('suppliers')
  @OrgPermissions('suppliers.manage', OrganizationRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createSupplier(
    @Param('orgId') orgId: string,
    @Body() dto: CreateSupplierDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.suppliersService.createSupplier(orgId, dto, actorId);
  }

  @Get('suppliers')
  @OrgPermissions(
    'suppliers.read',
    OrganizationRole.ADMIN,
    OrganizationRole.USER,
  )
  async findAllSuppliers(
    @Param('orgId') orgId: string,
    @Query() query: QuerySuppliersDto,
  ) {
    return this.suppliersService.findAll(orgId, query);
  }

  @Get('suppliers/:id')
  @OrgPermissions(
    'suppliers.read',
    OrganizationRole.ADMIN,
    OrganizationRole.USER,
  )
  async findSupplierById(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.suppliersService.findById(orgId, id);
  }

  @Patch('suppliers/:id')
  @OrgPermissions('suppliers.manage', OrganizationRole.ADMIN)
  async updateSupplier(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.suppliersService.updateSupplier(orgId, id, dto, actorId);
  }

  // ----------------------------------------------------
  // CUSTOMERS (CLIENTES)
  // ----------------------------------------------------
  @Post('customers')
  @OrgPermissions(OrganizationRole.ADMIN, OrganizationRole.USER)
  @HttpCode(HttpStatus.CREATED)
  async createCustomer(
    @Param('orgId') orgId: string,
    @Body() dto: CreateCustomerDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.customersService.createCustomer(orgId, dto, actorId);
  }

  @Get('customers')
  @OrgPermissions(OrganizationRole.ADMIN, OrganizationRole.USER)
  async findAllCustomers(
    @Param('orgId') orgId: string,
    @Query() query: QueryCustomersDto,
  ) {
    return this.customersService.findAll(orgId, query);
  }

  @Get('customers/:id')
  @OrgPermissions(OrganizationRole.ADMIN, OrganizationRole.USER)
  async findCustomerById(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.customersService.findById(orgId, id);
  }

  @Patch('customers/:id')
  @OrgPermissions(OrganizationRole.ADMIN, OrganizationRole.USER)
  async updateCustomer(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.customersService.updateCustomer(orgId, id, dto, actorId);
  }

  // ----------------------------------------------------
  // PURCHASES (COMPRAS)
  // ----------------------------------------------------
  @Post('purchases')
  @OrgPermissions('purchases.create', OrganizationRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createPurchase(
    @Param('orgId') orgId: string,
    @Body() dto: CreatePurchaseDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.purchasesService.createPurchase(orgId, dto, actorId);
  }

  @Get('purchases')
  @OrgPermissions(
    'purchases.read',
    OrganizationRole.ADMIN,
    OrganizationRole.USER,
  )
  async findAllPurchases(
    @Param('orgId') orgId: string,
    @Query() query: QueryPurchasesDto,
  ) {
    return this.purchasesService.findAll(orgId, query);
  }

  @Get('purchases/:id')
  @OrgPermissions(
    'purchases.read',
    OrganizationRole.ADMIN,
    OrganizationRole.USER,
  )
  async findPurchaseById(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.purchasesService.findById(orgId, id);
  }

  // ----------------------------------------------------
  // SALES (VENTAS & POS CHECKOUT)
  // ----------------------------------------------------
  @Post('sales')
  @OrgPermissions('sales.create', OrganizationRole.ADMIN, OrganizationRole.USER)
  @HttpCode(HttpStatus.CREATED)
  async createSale(
    @Param('orgId') orgId: string,
    @Body() dto: CreateSaleDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.salesService.createSale(orgId, dto, actorId);
  }

  @Get('sales')
  @OrgPermissions('sales.read', OrganizationRole.ADMIN, OrganizationRole.USER)
  async findAllSales(
    @Param('orgId') orgId: string,
    @Query() query: QuerySalesDto,
  ) {
    return this.salesService.findAll(orgId, query);
  }

  @Get('sales/:id')
  @OrgPermissions('sales.read', OrganizationRole.ADMIN, OrganizationRole.USER)
  async findSaleById(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.salesService.findById(orgId, id);
  }

  @Post('sales/:id/cancel')
  @OrgPermissions('sales.cancel', OrganizationRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async cancelSale(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser('id') actorId: string,
  ) {
    return this.salesService.cancelSale(
      orgId,
      id,
      reason || 'Anulación solicitada por Administrador',
      actorId,
    );
  }

  // ----------------------------------------------------
  // SURCOS FIT - GYM VISITS (§9.2)
  // ----------------------------------------------------
  @Post('gym/visits')
  @OrgPermissions(OrganizationRole.ADMIN, OrganizationRole.USER)
  @HttpCode(HttpStatus.CREATED)
  async createGymVisit(
    @Param('orgId') orgId: string,
    @Body() dto: CreateGymVisitDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.gymService.createVisit(orgId, dto, actorId);
  }

  @Get('gym/visits')
  @OrgPermissions(OrganizationRole.ADMIN, OrganizationRole.USER)
  async findAllGymVisits(
    @Param('orgId') orgId: string,
    @Query() query: QueryGymVisitsDto,
  ) {
    return this.gymService.findAllVisits(orgId, query);
  }

  // ----------------------------------------------------
  // SURCASINO - RECREATIONAL RENTALS (§9.3)
  // ----------------------------------------------------
  @Post('rentals')
  @OrgPermissions(OrganizationRole.ADMIN, OrganizationRole.USER)
  @HttpCode(HttpStatus.CREATED)
  async createRental(
    @Param('orgId') orgId: string,
    @Body() dto: CreateRentalDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.rentalsService.createRental(orgId, dto, actorId);
  }

  @Post('rentals/:id/return')
  @OrgPermissions(OrganizationRole.ADMIN, OrganizationRole.USER)
  @HttpCode(HttpStatus.OK)
  async returnRental(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: ReturnRentalDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.rentalsService.returnRental(orgId, id, dto, actorId);
  }

  @Get('rentals')
  @OrgPermissions(OrganizationRole.ADMIN, OrganizationRole.USER)
  async findAllRentals(
    @Param('orgId') orgId: string,
    @Query() query: QueryRentalsDto,
  ) {
    return this.rentalsService.findAll(orgId, query);
  }
}
