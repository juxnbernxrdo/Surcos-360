# Tasks Breakdown — `/auth` Backend Module

## Task Execution Graph

```text
TASK-01 (Foundation)
    ↓
TASK-02 (Registration Tokens Service)
    ↓
TASK-03 (Identity Linkage & Pre-imported Sync)
    ↓
TASK-04 (Supabase Auth Service Integration)
    ↓
TASK-05 (Registration Endpoint & Transaction)
    ↓
TASK-06 (Login & Logout & Session Management)
    ↓
TASK-07 (Guards & Decorators & Authorization)
    ↓
TASK-08 (Security Hardening: Rate Limiting & Anti-Enumeration & Audit)
    ↓
TASK-09 (Comprehensive Automated Testing Suite)
```

---

## Detailed Task List

### TASK-01: Schema Migration — Add `userType` to `InstitutionalPerson` (FIX-P1.1)
* **ID:** `TASK-01`
* **Description:** Add `userType UserType @default(STUDENT)` to `InstitutionalPerson` in `prisma/schema.prisma`. Run Prisma migration (`npx prisma migrate dev --name add_usertype_to_institutional_person`). Update `RolesGuard` to check `person.userType === role`.
* **Dependencies:** None
* **Affected Files:** `prisma/schema.prisma`, `backend/prisma/schema.prisma`, `backend/src/auth/guards/roles.guard.ts`
* **Acceptance Criteria:** `RolesGuard` successfully evaluates `person.userType` for all user roles.

---

### TASK-02: Concurrency & Atomic Token Redemption (FIX-P0.1)
* **ID:** `TASK-02`
* **Description:** Implement atomic token consumption in `tokens.service.ts` / `auth.service.ts` using conditional raw SQL update (`UPDATE "RegistrationToken" SET "usesCount" = "usesCount" + 1 ... WHERE "usesCount" < "maxUses"`).
* **Dependencies:** `TASK-01`
* **Affected Files:** `backend/src/auth/services/tokens.service.ts`, `backend/src/auth/services/auth.service.ts`
* **Acceptance Criteria:** Concurrent requests attempting to redeem a single-use token simultaneously result in exactly 1 success and N-1 safe 400 Bad Request rejections.

---

### TASK-03: Transactional Rollback Safety for Supabase Auth Users (FIX-P0.2)
* **ID:** `TASK-03`
* **Description:** Update `SupabaseAuthService` to include `deleteUser(userId)`. In `AuthService.register()`, wrap the DB transaction in a `try/catch` block that triggers `deleteUser(supabaseUser.id)` if any DB constraint or transaction failure occurs.
* **Dependencies:** `TASK-02`
* **Affected Files:** `backend/src/auth/services/supabase-auth.service.ts`, `backend/src/auth/services/auth.service.ts`
* **Acceptance Criteria:** If DB linkage fails, no orphan user remains in Supabase Auth.

---

### TASK-04: Strict Secrets & Environment Startup Guard (FIX-P1.2)
* **ID:** `TASK-04`
* **Description:** Remove insecure hardcoded fallback secrets from `JwtStrategy` and `SupabaseAuthService`. Throw a fatal startup error in `main.ts` or module init if `SUPABASE_JWT_SECRET` or `SUPABASE_SERVICE_ROLE_KEY` is missing in production/staging environments.
* **Dependencies:** `TASK-01`
* **Affected Files:** `backend/src/auth/strategies/jwt.strategy.ts`, `backend/src/auth/services/supabase-auth.service.ts`, `backend/src/main.ts`
* **Acceptance Criteria:** Backend refuses to start with missing security secrets in non-development mode.

---

### TASK-05: Rate Limiting & Identity Match Strictness (FIX-P1.3 / FIX-P1.4)
* **ID:** `TASK-05`
* **Description:** Add `@Throttle()` rate limiting decorators to `TokensController`. Tighten identity match logic in `AuthService.register()` to use strict `AND` matching for email and institutional code or exact metadata matching. Fix `RegistrationToken.createdBy` fallback for system admin tokens.
* **Dependencies:** `TASK-02`, `TASK-03`
* **Affected Files:** `backend/src/auth/controllers/tokens.controller.ts`, `backend/src/auth/services/auth.service.ts`
* **Acceptance Criteria:** `TokensController` limits request rates; identity matching is strictly unambiguous.

---

### TASK-06: Comprehensive Automated & Concurrency Testing Suite (FIX-P1.5)
* **ID:** `TASK-06`
* **Description:** Update unit and E2E test suites (`auth.service.spec.ts`, `tokens.service.spec.ts`, `auth.e2e-spec.ts`) to test atomic token consumption, Supabase Auth user deletion on failure, `RolesGuard` with `userType`, and anti-enumeration behaviors.
* **Dependencies:** `TASK-01` through `TASK-05`
* **Affected Files:** `backend/src/auth/services/auth.service.spec.ts`, `backend/src/auth/services/tokens.service.spec.ts`, `backend/test/auth.e2e-spec.ts`
* **Acceptance Criteria:** All unit and E2E tests pass (`npm test`, `npm run test:e2e`).
