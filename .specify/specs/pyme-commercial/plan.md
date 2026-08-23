# Technical Plan — PYME Commercial Module Implementation

## 1. Database Schema Refinements (`schema.prisma`)
1. Update `Customer` model:
   - Make `institutionalPersonId` optional (`String?`).
   - Add `organizationId String?`, `name String?`, `email String?`, `phone String?`, `taxId String?`, `customerType String`, `isActive Boolean`.
   - Update `InstitutionalPerson` to have `customers Customer[]`.
2. Update `Supplier` model:
   - Add `institutionalPersonId String?` (optional link).
   - Add `paymentTerms String?`.
   - Update `InstitutionalPerson` to have `suppliers Supplier[]`.
3. Update `Purchase` and `Sale` models:
   - Add `status`, `paymentTerms`, `paymentMethod`, `invoiceNumber`, `notes`.

## 2. NestJS Architecture
1. **Module:** `CommercialModule` (`src/commercial/commercial.module.ts`)
2. **Services:**
   - `ProductsService`: Products CRUD, inventory levels, low-stock query, manual adjustments.
   - `SuppliersService`: External & internal suppliers CRUD, purchase history.
   - `CustomersService`: External & institutional customer creation, lookup by code/taxId/email.
   - `PurchasesService`: Commercial purchase registration with atomic WAC recalculation, inventory addition, and movements.
   - `SalesService`: Multi-item checkout with concurrency locking, stock reduction, student account debit or cash handling, ledger posting.
3. **Controllers:**
   - `CommercialController` (`/organizations/:orgId/commercial/...` and `/commercial/...`)
   - `AgroredController` (convenience endpoints for AgroRed `/agrored/...` delegating to commercial services).
4. **DTOs:** Validated with `class-validator` and `class-transformer`.
5. **Guards:** `JwtAuthGuard`, `RolesGuard`, `OrgPermissionsGuard`.

## 3. Testing Plan
1. Unit tests for `ProductsService`, `SuppliersService`, `CustomersService`, `PurchasesService`, `SalesService`.
2. Integration & E2E tests for `/organizations/:orgId/commercial` routes.
3. Security tests: Cross-tenant isolation, unauthorized role rejections, negative amounts, overselling prevention, concurrency locking.
