# Quality & Security Checklist — Students Module (`/students`)

## 1. Functional & Domain Correctness
- [x] `InstitutionalPerson` created with exact email and institutional code without duplicates.
- [x] `StudentRecord` linked 1-to-1 with course and tutor.
- [x] `Customer` record automatically created for PYME checkouts.
- [x] `StudentAccount` created with unique formatted account number (`ACC-STU-...`).
- [x] When `initialBalance > 0`, double-entry transaction posted: $\sum \text{DEBIT} = \sum \text{CREDIT}$.
- [x] Plaintext token returned once for redemption; token hash stored securely with SHA-256.
- [x] Student dashboard calculates `currentBalance`, `savedAmount`, and `totalExpenses` strictly from `LedgerEntry` sums, never from a mutable balance field.
- [x] Single and bulk import endpoints handle conflicts gracefully with meaningful error reporting and intra-batch duplicate detection.
- [x] Full student statement endpoint (`GET /students/me/statement`) with pagination and transaction filtering implemented.
- [x] Safe updates and status changes (`ACTIVE`, `INACTIVE`, `SUSPENDED`) with audit logging.

## 2. Security & Three-Layer Authorization
- [x] NestJS `JwtAuthGuard` + `RolesGuard` applied across all controller endpoints.
- [x] Student users restricted from calling admin endpoints (`POST /students`, `POST /students/import`, `GET /students`, `PATCH /students/:id`).
- [x] Student users can only fetch `/students/me/dashboard`, `/students/me/statement`, and `/students/me/profile` matching their authenticated identity.
- [x] Cashier lookup endpoint (`GET /students/lookup`) protected against student enumeration (plain students rejected with `403 Forbidden`).
- [x] Monetary operations strictly use `Prisma.Decimal` / `NUMERIC(12,2)`. No floats.
- [x] AuditLog entry generated for all student creation, update, status change, and bulk import actions.
- [x] CurrentUser decorator extracts actor ID reliably from institutionalPerson or user context.

## 3. Frontend & Emil Kowalski Quality Gate
- [x] `emil-design-eng` & `apple-design` principles applied to layout and visual hierarchy.
- [x] `animate` & `animation-vocabulary` applied for purposeful, functional state transitions.
- [x] Full support for `prefers-reduced-motion` in CSS.
- [x] Loading skeleton, empty state, error state, and success feedback implemented.
- [x] Mobile responsive layout without horizontal overflow.
- [x] Touch targets $\ge 44\text{px}$ and WCAG AA color contrast.

## 4. Testing & Definition of Done
- [x] Unit tests for `StudentsService` covering creation, balance computation, bulk import, statements, lookup, and edge cases (49/49 passing).
- [x] E2E/Integration tests for `StudentsController` covering authorization, validation, lookups, security, and updates (28/28 passing).
- [x] Zero TypeScript errors in both backend and frontend (`npm run build` exits with code 0).
- [x] All test suites passing cleanly.
- [x] Production Ready Gate verified.
