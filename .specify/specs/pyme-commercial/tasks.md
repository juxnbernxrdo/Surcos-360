# Implementation Tasks — PYME Commercial Module

- [ ] `TASK-COM-01`: Update Prisma Schema for `Supplier`, `Customer`, `Purchase`, `Sale` to decouple commercial counterparties from mandatory users and support multi-tenant commercial operations.
- [ ] `TASK-COM-02`: Run `prisma generate` to update Prisma Client types across backend.
- [ ] `TASK-COM-03`: Create DTOs with validation rules for Products, Inventory adjustments, Suppliers, Customers, Purchases, and Sales.
- [ ] `TASK-COM-04`: Implement `CommercialModule` and `CommercialService` (or dedicated sub-services) with full business logic:
  - Products & Inventory management
  - Suppliers management (external & linked)
  - Customers management (external & linked)
  - Purchases with atomic WAC recalculation and stock increments
  - Sales with `FOR UPDATE` concurrency locking, stock deductions, and double-entry ledger posting
- [ ] `TASK-COM-05`: Implement `CommercialController` with REST endpoints protected by `JwtAuthGuard`, `RolesGuard`, and `OrgPermissionsGuard`.
- [ ] `TASK-COM-06`: Implement `AgroredController` / `AgroredModule` connecting to commercial engine for seamless AgroRed operations.
- [ ] `TASK-COM-07`: Write comprehensive unit tests for commercial services.
- [ ] `TASK-COM-08`: Write E2E / security tests verifying multi-tenancy, WAC math, overselling locks, and IDOR protection.
- [ ] `TASK-COM-09`: Write in-module README documentation with Mermaid architecture and sequence diagrams.
- [ ] `TASK-COM-10`: Run full test suite & build check to verify Production Readiness.
