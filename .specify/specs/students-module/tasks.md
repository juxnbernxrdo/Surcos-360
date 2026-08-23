# Tasks Breakdown — Students & Institutional Identity Module

## Task Dependency Graph
```text
Task 1 (DTOs & Types)
   ↓
Task 2 (StudentsService Domain Logic & Ledger Integration)
   ↓
Task 3 (StudentsController & Role Guards)
   ↓
Task 4 (StudentsModule Wire-up & AppModule Integration)
   ↓
Task 5 (Frontend Student Management & Emil Kowalski Dashboard Enhancement)
   ↓
Task 6 (Unit & E2E Testing Suite)
   ↓
Task 7 (Analysis & Convergence)
```

---

## Detailed Tasks

### `TASK-STU-01`: DTOs & Validation Contracts
- **Description:** Implement `CreateStudentDto`, `BulkImportStudentsDto`, `StudentQueryDto`, `StudentResponseDto`, and `StudentDashboardDto`.
- **Files:** `backend/src/students/dto/*.ts`
- **Dependencies:** None
- **Acceptance Criteria:** Strict validation using `class-validator` (email, strings, numbers, positive decimals).

### `TASK-STU-02`: StudentsService Implementation
- **Description:** Implement `StudentsService` with atomic transactions:
  - `createStudent`: Creates `InstitutionalPerson`, `StudentRecord`, `Customer`, `StudentAccount`, posts `INITIAL_BALANCE` via `LedgerService`, issues `RegistrationToken`, and writes `AuditLog`.
  - `bulkImport`: Batch processes students, rolls back or collects errors per item, generates tokens and accounts.
  - `getStudentDashboard`: Derives balance from ledger, computes expenses and returns formatted dashboard data.
  - `findAll`: Lists and filters students for admins.
  - `findById`: Retrieves student by ID.
- **Files:** `backend/src/students/students.service.ts`
- **Dependencies:** `TASK-STU-01`, `LedgerService`, `TokensService`
- **Acceptance Criteria:** Double-entry ledger balanced, zero floats, conflict checks.

### `TASK-STU-03`: StudentsController & Authorization
- **Description:** Implement `StudentsController` exposing:
  - `POST /students` (`@Roles(UserType.AUTHORITY, UserType.TEACHER)`)
  - `POST /students/import` (`@Roles(UserType.AUTHORITY)`)
  - `GET /students` (`@Roles(UserType.AUTHORITY, UserType.TEACHER, UserType.STUDENT)`)
  - `GET /students/me/dashboard` (`@CurrentUser()` -> resolves student)
  - `GET /students/me/statement` (`@CurrentUser()`)
  - `GET /students/:id` (`@Roles(UserType.AUTHORITY, UserType.TEACHER)`)
- **Files:** `backend/src/students/students.controller.ts`
- **Dependencies:** `TASK-STU-02`
- **Acceptance Criteria:** HTTP codes conformant, Guards applied.

### `TASK-STU-04`: Module Integration
- **Description:** Register `StudentsModule` in `AppModule`.
- **Files:** `backend/src/students/students.module.ts`, `backend/src/app.module.ts`
- **Dependencies:** `TASK-STU-03`
- **Acceptance Criteria:** Clean DI resolution in NestJS.

### `TASK-STU-05`: Frontend Integration & Emil Kowalski Quality Gate
- **Skills Tag:** `[Frontend/UX - emil-design-eng, apple-design, animate, review-animations]`
- **Description:** 
  1. Build `/students` admin table view with creation modal and CSV import tool.
  2. Enhance `StudentDashboard.tsx` with dynamic backend data fetching, skeleton loading state, empty state, and Emil Kowalski motion system with `prefers-reduced-motion`.
- **Files:** `frontend/src/app/dashboard/page.tsx`, `frontend/src/app/students/page.tsx`, `frontend/src/components/StudentDashboard.tsx`, `frontend/src/components/StudentManager.tsx`
- **Dependencies:** `TASK-STU-04`
- **Acceptance Criteria:** Responsive, zero overflow, functional motion, full state coverage.

### `TASK-STU-06`: Unit & E2E Testing
- **Description:** Comprehensive unit tests for `StudentsService` and E2E tests for `StudentsController`.
- **Files:** `backend/src/students/students.service.spec.ts`, `backend/test/students.e2e-spec.ts`
- **Dependencies:** `TASK-STU-04`
- **Acceptance Criteria:** 100% critical branch coverage on balance calculation and atomic creation.
