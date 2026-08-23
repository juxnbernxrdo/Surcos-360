# Functional Specification — Students & Institutional Identity Module (`/students`)

## 1. Context & Business Domain
According to **Surcos 360 PRD v4 (§4, §5, §7.1, §9)**, the **Students & Institutional Identity Module** is the foundational core that bridges institutional identity (`InstitutionalPerson`), student academic records (`StudentRecord`), financial accounts (`StudentAccount`), double-entry ledger balances, and student user access.

### 1.1 Scope in V0
1. **Institutional Identity Management:** Creation, retrieval, filtering, and single/batch import (CSV/JSON) of students without duplicating records.
2. **Student Accounts & Initial Funding:** Automatic creation of `StudentAccount` and atomic creation of `INITIAL_BALANCE` transaction in the double-entry ledger (`LedgerEntry`) whenever a student is created with an initial balance.
3. **Onboarding Token Issuance:** Generation of polymorphic `RegistrationToken` (type: `STUDENT`) for each created/imported student to enable self-registration.
4. **Student Dashboard & Financial Statement API:** Read-only endpoint for students to view their balance, initial amount, total expenditures, and itemized transaction activity per organization.
5. **3-Layer Security & Authorization:** Absolute enforcement that students cannot mutate financial or inventory data, only query their personal profile and ledger records.

---

## 2. Actors & Roles
- **Global Administrator / Authority (Surcos Saving):** Can create, import, search, list, and view all student profiles and financial accounts. Can issue/reissue registration tokens.
- **Teacher / Tutor:** Can query students within their assigned course/institution.
- **Student:** Can strictly query their own profile, student account balance, and movement history. Cannot see other students' balances. Cannot execute commercial mutations.
- **PYME Employee/Manager (e.g. AgroRed):** Can lookup students as customers (`Customer` / `InstitutionalPerson`) for checkout by institutional code or email, without viewing full student financial history.

---

## 3. User Stories (IDs: `STU-US-*`)

| ID | Title | Description | Acceptance Criteria |
|---|---|---|---|
| `STU-US-01` | Single Student Creation & Funding | As a Surcos Saving Admin, I want to register a student with course and initial balance so they have an account ready. | Creates `InstitutionalPerson`, `StudentRecord`, `StudentAccount`, posts balanced `INITIAL_BALANCE` ledger transaction, and creates `RegistrationToken`. |
| `STU-US-02` | Bulk Student Import (CSV/JSON) | As an Admin, I want to import a list of students with initial balances so onboarding a class is instantaneous. | Validates each row, performs atomic imports per batch, generates accounts + ledger balances, and returns summary (success/errors). Exact match by code/email avoids duplicates. |
| `STU-US-03` | Student Dashboard Data Query | As a Student, I want to log in and see my current balance, initial balance, total spent, and recent purchases. | Derived balance is calculated from append-only `LedgerEntry`. Returns formatted breakdown matching PRD v4 §5. |
| `STU-US-04` | Student Account Statement & History | As a Student or Admin, I want to see detailed movements (AgroRed purchases, deposits, adjustments). | Returns paginated list of ledger entries with store name, transaction type, date, and signed amount. |
| `STU-US-05` | Student Lookup for Checkout | As an AgroRed cashier, I want to look up a student by institutional code or email to bill them. | Returns student ID, full name, code, and account ID without exposing personal sensitive data. |

---

## 4. Functional Requirements (IDs: `STU-FR-*`)

- `STU-FR-01`: **Atomic Registration & Initial Balance Ledger Posting:**
  When a student is created with an `initialBalance > 0`:
  1. `InstitutionalPerson` is created with `userType: STUDENT`.
  2. `StudentRecord` is created with `course` and optional `tutor`.
  3. `Customer` record is created for PYME checkouts.
  4. `StudentAccount` is generated with a unique `accountNumber` (e.g., `ACC-STU-YYYYMMDD-XXXX`).
  5. An `INITIAL_BALANCE` double-entry transaction is posted:
     - `CREDIT` to `StudentAccount` (increases student funds/liability).
     - `DEBIT` to `Saving Central Capital/Fund Account` (asset/equity account).
  6. `AuditLog` entry is recorded.

- `STU-FR-02`: **Exact Match & Conflict Prevention:**
  If an `email` or `institutionalCode` already exists:
  - Return `409 ConflictException` with descriptive reason.
  - In bulk import, reject colliding rows and report index/field while processing valid rows.

- `STU-FR-03`: **Registration Token Linkage:**
  Upon student creation, automatically issue a `RegistrationToken` of type `STUDENT` with hashed token and metadata `{ studentId, email, institutionalCode }`.

- `STU-FR-04`: **Derived Balance Computation:**
  Student balance MUST never be read from a mutable scalar column. It MUST be computed via `LedgerService.getStudentAccountBalance(studentAccountId)` by summing debits and credits.

- `STU-FR-05`: **Three-Layer Access Enforcement:**
  - Layer 1: Frontend components filter UI actions.
  - Layer 2: NestJS `JwtAuthGuard` + `RolesGuard` (`@Roles('AUTHORITY', 'TEACHER')` for creation/import; students can only access `/students/me/*`).
  - Layer 3: Postgres RLS ensures users can only read their own `StudentAccount` and `LedgerEntry`.

---

## 5. Non-Functional Requirements (IDs: `STU-NFR-*`)
- `STU-NFR-01`: **Precision:** All monetary amounts must use `Prisma.Decimal` / `NUMERIC(12,2)`. No floats.
- `STU-NFR-02`: **Performance:** Batch import of 100 students in `< 1.5s` within a single database transaction.
- `STU-NFR-03`: **Auditability:** Every mutation (create, import, status change) writes to `AuditLog`.
- `STU-NFR-04`: **Idempotency:** Batch import and initial balance creation accept client `Idempotency-Key`.

---

## 6. Business Rules & Edge Cases
1. **Negative Initial Balance:** Rejected with `400 BadRequestException`.
2. **Zero Initial Balance:** Valid. Creates `StudentAccount` without posting initial ledger entry.
3. **Student Trying to Access Other Student's Account:** Returns `403 ForbiddenException`.
4. **Graduation / Course Change:** Supports updating `StudentRecord.course` without mutating `InstitutionalPerson.id` or `StudentAccount.id`.
