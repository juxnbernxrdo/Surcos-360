# Quality & Security Checklist — PYME Commercial Module

## 1. Domain & Architecture Checklist
- [ ] `Supplier` supports both external (no `User`) and institutional (`InstitutionalPerson` linked) counterparties.
- [ ] `Customer` supports both external (no `User`) and institutional (`Student`, `Teacher`, `Authority`, `Representative`) counterparties.
- [ ] No duplicate identities created when an existing user acts as a supplier or customer.
- [ ] Product catalog properly scoped per organization with SKU uniqueness per PYME.
- [ ] Purchases atomically recalculate WAC under concurrency lock and update stock levels.
- [ ] Sales atomically check available balance/stock under `FOR UPDATE` lock and deduct inventory.
- [ ] Gross profit computed accurately: $\text{Total} - \text{COGS}$.
- [ ] Double-entry ledger entries posted for student account debit and organization revenue credit.

## 2. Security & Multi-Tenancy Checklist
- [ ] NestJS `JwtAuthGuard` + `RolesGuard` + `OrgPermissionsGuard` applied across all commercial endpoints.
- [ ] Strict tenant isolation: Organization A cannot view or manipulate Organization B's products, suppliers, purchases, or sales.
- [ ] Validation against negative quantities, negative prices, or malformed inputs.
- [ ] Audit logs recorded for all commercial mutations (Products, Purchases, Sales, Adjustments).

## 3. Testing & Production Gate Checklist
- [ ] Unit test suite passing for all commercial services.
- [ ] E2E tests covering full lifecycle: Supplier -> Purchase (Stock & WAC update) -> Customer -> Sale (Stock deduction & Ledger).
- [ ] Zero TypeScript or linter errors (`npm run build` exits 0).
- [ ] In-module documentation (`backend/src/commercial/README.md`) complete.
