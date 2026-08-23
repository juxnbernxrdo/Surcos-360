# Architectural Clarifications — PYME Commercial Module

## 1. Resolved Design Decisions

### D1: How are External vs. Internal Counterparties Modeled?
- **Customer**: Contains optional `institutionalPersonId`. If provided, it links to the Surcos 360 `InstitutionalPerson` (Student, Teacher, Representative, Authority). If `null`, it represents an external customer (e.g. parent without account, visitor, community member).
- **Supplier**: Contains optional `institutionalPersonId`. If `null`, it represents an external commercial supplier/company (with `companyName`, `taxId` RUC, `paymentTerms`). If provided, it links to an institutional person (e.g., Teacher who supplies materials).

### D2: Scoping and Multi-Tenancy
- All commercial records (`Product`, `Inventory`, `Supplier`, `Purchase`, `Sale`) belong explicitly to an `Organization` (`organizationId`).
- `Customer` can be scoped to an `organizationId` or linked to an `InstitutionalPerson` across the institution.
- Endpoints enforce tenant isolation through `OrgPermissionsGuard` and service-level checks where `organizationId` must match the URL and user's active membership.

### D3: Concurrency in Purchases and Sales
- Purchases use `$queryRaw` with `FOR UPDATE` to lock product rows while computing the new Weighted Average Cost (WAC).
- Sales use `$queryRaw` with `FOR UPDATE` to lock product and inventory rows, preventing overselling or reading stale stock/WAC.

### D4: Double-Entry Financial Integration
- Sales paid with `STUDENT_ACCOUNT` post double-entry ledger entries:
  - `DEBIT` StudentAccount (decreases student funds)
  - `CREDIT` Organization Revenue LedgerAccount (increases PYME revenue)
- Sales paid with `CASH` / external methods post:
  - `DEBIT` Organization Cash/Asset LedgerAccount
  - `CREDIT` Organization Revenue LedgerAccount
- Purchases can be settled immediately or generate accounts payable.
