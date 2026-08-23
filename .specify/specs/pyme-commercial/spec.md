# Functional Specification — PYME Commercial Module (`/commercial` & PYMEs)

## 1. Context & Business Domain
According to **Surcos 360 PRD v4 (§4.1, §4.2, §6, §7.3, §9 V0)**, every PYME in Surcos 360 (AgroRed, Surcos Fit, Surcasino, and any future PYME) requires a complete, multi-tenant commercial engine capable of executing both **purchases from suppliers** and **sales to customers**, strictly separating commercial counterparties (`Customer`, `Supplier`) from platform identity (`InstitutionalPerson`, `User`).

### 1.1 Fundamental Commercial Rule
- **Platform Identity $\neq$ Commercial Counterparty**:
  - A **Supplier** can be an **external entity** (company, external vendor) without any `User` or `InstitutionalPerson` in Surcos 360.
  - A **Supplier** can also optionally link to an `InstitutionalPerson` (e.g. a Teacher or Authority supplying materials) without creating duplicate identities.
  - A **Customer** can be an **external person/entity** (no user account required).
  - A **Customer** can also link to an `InstitutionalPerson` (Student, Teacher, Representative, Authority).
  - A Student can be a Customer in multiple PYMEs (e.g. AgroRed, Fit, Casino) and simultaneously an Employee in one PYME (`Membership`).

---

## 2. Multi-Tenant Commercial Architecture

```text
                                Surcos 360
                                    │
                         ┌──────────┴──────────┐
                         │   Organization/PYME │
                         └──────────┬──────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  │                                   │
              PURCHASES                             SALES
                  │                                   │
                  ▼                                   ▼
              SUPPLIERS                           CUSTOMERS
                  │                                   │
        ┌─────────┴─────────┐               ┌─────────┴─────────┐
        │                   │               │                   │
    External           Linked to         External           Linked to
    Supplier          Institutional      Customer          Institutional
   (No User)             Person         (No User)             Person
                     (Teacher/Staff)                     (Student/Parent/Staff)
```

---

## 3. Core Functional Requirements (IDs: `COM-FR-*`)

### 3.1 Suppliers Management (`COM-FR-01`)
- Register external suppliers with `name`, `companyName`, `taxId` (RUC/Cédula), `email`, `phone`, `address`, `paymentTerms`, and active status.
- Register internal suppliers linked to an existing `InstitutionalPerson`.
- Multi-tenant query of suppliers strictly scoped to the active `organizationId`.
- Search, filter by active status, update details, and view purchase history.

### 3.2 Customers Management (`COM-FR-02`)
- Register external customers with name, taxId, email, phone, and `customerType = EXTERNAL`.
- Query and link institutional customers (`STUDENT`, `TEACHER`, `REPRESENTATIVE`, `AUTHORITY`).
- Scoped strictly by `organizationId` or resolved via institutional identity.

### 3.3 Product Catalog & WAC Inventory (`COM-FR-03`)
- Manage products per PYME with `sku`, `name`, `category`, `unit`, `salePrice`, and `averageCost` (WAC).
- Automatically initialize `Inventory` record per product for the organization's location.
- Support stock querying, low stock threshold alerts, and manual inventory adjustments with audit trail (`InventoryMovement`).

### 3.4 Purchases & WAC Recalculation (`COM-FR-04`)
- Create commercial purchase with line items (`productId`, `quantity`, `unitCost`, `subtotal`), supplier, invoice number, and payment terms.
- Within an atomic database transaction:
  1. Increment product stock in `Inventory`.
  2. Record `InventoryMovement` of type `PURCHASE`.
  3. Recalculate Weighted Average Cost (WAC) for each purchased product under concurrency lock:
     $$\text{WAC}_{\text{new}} = \frac{(\text{Stock}_{\text{curr}} \times \text{WAC}_{\text{old}}) + (\text{Qty}_{\text{purchased}} \times \text{UnitCost}_{\text{purchased}})}{\text{Stock}_{\text{curr}} + \text{Qty}_{\text{purchased}}}$$
  4. Create `Purchase` and `PurchaseItem` records.
  5. Record `AuditLog`.

### 3.5 Sales & Point of Sale (POS) Checkout (`COM-FR-05`)
- Execute sale for customer (Institutional Student or External Customer).
- Within an atomic database transaction:
  1. Acquire row lock (`SELECT ... FOR UPDATE`) on `Product` and `Inventory` rows.
  2. Verify stock sufficiency ($\text{Stock} \ge \text{Quantity}$).
  3. Deduct stock and record `InventoryMovement` of type `SALE`.
  4. Compute Cost of Goods Sold ($\text{COGS} = \sum \text{Quantity} \times \text{WAC}$) and Gross Profit ($\text{Total} - \text{COGS}$).
  5. If payment method is `STUDENT_ACCOUNT`:
     - Verify student available balance $\ge$ total sale amount.
     - Post balanced double-entry transaction: `DEBIT StudentAccount` / `CREDIT Organization Revenue Account`.
  6. If payment method is `CASH` / `EXTERNAL`:
     - Post balanced double-entry transaction: `DEBIT Organization Asset/Cash Account` / `CREDIT Organization Revenue Account`.
  7. Create `Sale` and `SaleItem` records.
  8. Record `AuditLog`.

---

## 4. Non-Functional & Security Requirements (`COM-NFR-*`)
- `COM-NFR-01`: **Precision:** All money and quantities use `Prisma.Decimal` / `@db.Decimal(12,2)`. No floats.
- `COM-NFR-02`: **Tenant Isolation:** Enforce `organizationId` matching in all service calls and controller guards (`OrgPermissionsGuard`).
- `COM-NFR-03`: **Concurrency & Race Conditions:** Row locks (`FOR UPDATE`) in both WAC purchase calculations and sale stock deductions.
- `COM-NFR-04`: **Authorization RBAC:** Cashier/Sales operations require `EMPLOYEE`, `MANAGER`, `ADMIN`, or `OWNER` role in the organization. Product catalog edits and supplier setups require `MANAGER`, `ADMIN`, or `OWNER`.
