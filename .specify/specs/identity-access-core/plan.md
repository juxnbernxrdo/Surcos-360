# Technical Plan — Identity, Access & Governance Core

## 1. Architectural Blueprint

```text
                  HTTP Request / JWT Bearer
                              │
                              ▼
            ┌───────────────────────────────────┐
            │  Global HttpExceptionFilter       │
            │  Global Logging & RequestId       │
            │  IdempotencyInterceptor           │
            │  ThrottlerGuard (Rate Limiting)   │
            └─────────────────┬─────────────────┘
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
       ┌───────────────┐             ┌───────────────┐
       │ JwtAuthGuard  │             │  RolesGuard   │
       └───────┬───────┘             └───────┬───────┘
               │                             │
               ▼                             ▼
       ┌─────────────────────────────────────────────┐
       │           OrgPermissionsGuard               │
       └──────────────────────┬──────────────────────┘
                              │
        ┌─────────────┬───────┴─────┬─────────────┐
        ▼             ▼             ▼             ▼
  AuthModule    UsersModule   StudentsModule  OrganizationsModule
        │             │             │             │
        └─────────────┼─────────────┼─────────────┘
                      ▼             ▼
              LedgerModule    PrismaModule
                      │             │
                      ▼             ▼
             Supabase Postgres + RLS Policies
```

---

## 2. Modules to Implement / Harden

### 2.1 `UsersModule` (`backend/src/users/`)
- `UsersController`:
  - `GET /users/me`: Authenticated user's profile with memberships, customer profile, student record, accounts.
  - `PATCH /users/me`: Profile updates (names, phone).
  - `GET /users`: (Guarded: `AUTHORITY`, `TEACHER`) List users with pagination, status filter, and search.
  - `GET /users/:id`: (Guarded: `AUTHORITY`, `TEACHER`) Single user with full relations.
  - `PATCH /users/:id/status`: (Guarded: `AUTHORITY`) Update `status` (`ACTIVE`, `INACTIVE`, `SUSPENDED`).
  - `POST /users/link-identity`: (Guarded: `AUTHORITY`) Link pre-imported `InstitutionalPerson` to a Supabase `userId`.
- `UsersService`: Business logic, audit logging, uniqueness and integrity checks.

### 2.2 `OrganizationsModule` (`backend/src/organizations/`)
- `OrganizationsController`:
  - `POST /organizations`: Create organization (Guarded: `AUTHORITY`).
  - `GET /organizations`: List all organizations.
  - `GET /organizations/:id`: Organization details with member count and ledger accounts.
  - `POST /organizations/:id/members`: Add member with role (Guarded: `AUTHORITY` or Org `OWNER`/`ADMIN`).
  - `PATCH /organizations/:id/members/:membershipId`: Update member role (Prevents privilege escalation).
  - `DELETE /organizations/:id/members/:membershipId`: Remove member / offboarding (Guarded: `AUTHORITY` or Org `OWNER`).
  - `GET /organizations/:id/members`: List organization members with details.
- `OrganizationsService`: Atomic operations with role verification and audit logging.

### 2.3 `CommonModule` (`backend/src/common/`)
- `HttpExceptionFilter`: Global exception formatting with timestamp, path, requestId, error code, and friendly message.
- `IdempotencyInterceptor`: Intercepts mutating requests (POST, PATCH, PUT) with `Idempotency-Key` header, looks up cached response in `IdempotencyKey` table, returns cached response if key matches `actorId` and `endpoint`, or stores response after execution.

### 2.4 CI/CD Automation (`.github/workflows/ci.yml`)
- Automates: Linting, Typecheck, Unit Tests, E2E Tests, and Production Build on both `backend/` and `frontend/`.

### 2.5 In-Module Documentation
- `backend/src/auth/README.md`, `architecture.md`, `security.md`
- `backend/src/users/README.md`, `architecture.md`, `security.md`
- `backend/src/organizations/README.md`, `architecture.md`, `security.md`
- `backend/src/students/README.md`, `architecture.md`, `security.md`
- `backend/src/ledger/README.md`, `architecture.md`, `security.md`
