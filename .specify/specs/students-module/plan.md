# Technical Plan — Students & Institutional Identity Module

## 1. Architecture Overview
This module encompasses:
1. **NestJS Backend Module (`StudentsModule`):**
   - `StudentsController`: Endpoints for listing, creating, bulk importing, single lookup, and student self-service dashboard/statement.
   - `StudentsService`: Core domain logic for identity resolution, atomic account generation, double-entry ledger funding, token issuance, and statement derivation.
   - DTOs & Validation: Class-validator schemas for single creation, batch import, and query filters.
   - Authorization: Integration with `JwtAuthGuard`, `RolesGuard`, and `@Roles` decorators.
2. **Double-Entry Ledger Integration:**
   - Leveraging `LedgerService` to ensure `INITIAL_BALANCE` transactions are balanced with `SAVING_CENTRAL_VAULT`.
3. **Frontend System (`Students` & `StudentDashboard`):**
   - Modernized UI conforming to **Emil Kowalski Design Engineering Principles**.
   - Accessible, high-contrast visual hierarchy, skeleton loading states, empty states, error handling, and motion respecting `prefers-reduced-motion`.

---

## 2. API Contract & Endpoints

### 2.1 Admin / Authority Endpoints
- `POST /students` (Guarded: `AUTHORITY`, `TEACHER`)
  - Body: `{ firstName, lastName, email, institutionalCode, course, tutor?, initialBalance? }`
  - Response: `{ student: InstitutionalPerson, account: StudentAccount, registrationToken: string, initialBalance: string }`
- `POST /students/import` (Guarded: `AUTHORITY`)
  - Body: `{ students: Array<CreateStudentDto> }` or multipart CSV
  - Response: `{ importedCount, failedCount, results: Array<{ row, status, student?, token?, error? }> }`
- `GET /students` (Guarded: `AUTHORITY`, `TEACHER`, `EMPLOYEE`)
  - Query: `?course=&search=&page=&limit=`
  - Response: `{ data: StudentListItemDto[], total, page, limit }`
- `GET /students/:id` (Guarded: `AUTHORITY`, `TEACHER`)
  - Response: Detailed student profile with account, balance, and record.

### 2.2 Student Self-Service Endpoints
- `GET /students/me/dashboard` (Guarded: `STUDENT`, `TEACHER`, `AUTHORITY`)
  - Resolves logged-in user from JWT.
  - Response:
    ```json
    {
      "student": {
        "id": "uuid",
        "firstName": "Juan",
        "lastName": "Pérez",
        "course": "3ro BGU",
        "tutor": "María González"
      },
      "financials": {
        "accountNumber": "ACC-STU-...",
        "initialBalance": 100.00,
        "savedAmount": 0.00,
        "totalExpenses": 16.50,
        "currentBalance": 83.50
      },
      "recentActivity": [
        {
          "id": "tx-1",
          "storeName": "AgroRed",
          "description": "AgroRed Sale #123",
          "amount": -8.50,
          "type": "PURCHASE",
          "date": "2026-08-14T10:00:00Z"
        }
      ]
    }
    ```
- `GET /students/me/statement` (Guarded: `STUDENT`)
  - Query: `?page=1&limit=20`
  - Response: Paginated ledger transactions and entries.

---

## 3. Data Flow & Transaction Sequences

```text
Admin POST /students
   │
   ▼
StudentsController (JwtAuthGuard + RolesGuard)
   │
   ▼
StudentsService.createStudent(input)
   │
   ├─► Prisma $transaction (Atomic):
   │     1. Check for email/code uniqueness
   │     2. Create InstitutionalPerson (userType: STUDENT)
   │     3. Create StudentRecord (course, tutor)
   │     4. Create Customer (for PYME purchases)
   │     5. Create StudentAccount (unique accountNumber)
   │     6. IF initialBalance > 0:
   │          - Find/Create Organization "SAVING" & LedgerAccount "SAVING_CENTRAL_VAULT"
   │          - Create Transaction (type: INITIAL_BALANCE)
   │          - Create LedgerEntry (CREDIT StudentAccount, amount)
   │          - Create LedgerEntry (DEBIT SavingCentralAccount, amount)
   │     7. Generate RegistrationToken (type: STUDENT, sha256 hash)
   │     8. Create AuditLog entry
   │
   ▼
Return student profile, account info, and plaintext registration token
```

---

## 4. Frontend Design & Motion System (Emil Kowalski Mandatory Skills)
- **Skills applied:** `emil-design-eng`, `apple-design`, `animate`, `review-animations`, `animation-vocabulary`.
- **Layout & Structure:** Clean, functional information hierarchy; high-contrast numbers for financial figures; tailored color palette (Slate / Emerald / Rose / Indigo).
- **Motion & Interactions:**
  - Micro-interactions on balance cards (subtle scale on hover, transition 150ms ease-out).
  - List enter stagger animation for activity feed using standard CSS transitions.
  - Zero decorative bloat.
  - Media query `@media (prefers-reduced-motion: reduce)` disables all transforms.
- **States:**
  - Skeleton loading view when fetching dashboard data.
  - Error banner with retry trigger.
  - Empty state when no transactions exist.

---

## 5. Security & Defense in Depth
1. **Layer 1:** Frontend routes `/students/manage` restricted to admin; students only see `/dashboard`.
2. **Layer 2:** NestJS Guards verify JWT and role. `StudentsService` ensures student users can only read their linked `InstitutionalPerson`.
3. **Layer 3:** Postgres schema constraints (`UNIQUE`, foreign keys, decimal precision) and RLS policy compatibility.
