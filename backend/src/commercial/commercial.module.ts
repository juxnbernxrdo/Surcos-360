import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LedgerModule } from '../ledger/ledger.module';
import { CommercialController } from './commercial.controller';
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

@Module({
  imports: [PrismaModule, LedgerModule],
  controllers: [CommercialController],
  providers: [
    ProductsService,
    SuppliersService,
    CustomersService,
    PurchasesService,
    SalesService,
    CommercialService,
    AssetsService,
    LiabilitiesService,
    ExpensesService,
    GymService,
    RentalsService,
  ],
  exports: [
    ProductsService,
    SuppliersService,
    CustomersService,
    PurchasesService,
    SalesService,
    CommercialService,
    AssetsService,
    LiabilitiesService,
    ExpensesService,
    GymService,
    RentalsService,
  ],
})
export class CommercialModule {}
