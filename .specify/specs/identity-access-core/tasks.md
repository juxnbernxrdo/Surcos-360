# Tasks Breakdown — Identity, Access & Governance Core

## Task List & Execution Order

1. **`TASK-CORE-01` (Common & Idempotency Module):**
   - Implement `IdempotencyService`, `IdempotencyInterceptor`, and global `HttpExceptionFilter`.
   - Files: `backend/src/common/filters/http-exception.filter.ts`, `backend/src/common/interceptors/idempotency.interceptor.ts`, `backend/src/common/services/idempotency.service.ts`, `backend/src/common/common.module.ts`.

2. **`TASK-CORE-02` (Users Module):**
   - Implement DTOs (`update-user.dto.ts`, `update-status.dto.ts`, `query-user.dto.ts`).
   - Implement `UsersService` & `UsersController`.
   - Register in `UsersModule` and `AppModule`.
   - Files: `backend/src/users/`.

3. **`TASK-CORE-03` (Organizations & Memberships Module):**
   - Implement DTOs (`create-org.dto.ts`, `add-member.dto.ts`, `update-member-role.dto.ts`).
   - Implement `OrganizationsService` & `OrganizationsController`.
   - Register in `OrganizationsModule` and `AppModule`.
   - Files: `backend/src/organizations/`.

4. **`TASK-CORE-04` (Guards & Authorization Hardening):**
   - Endow `RolesGuard` and `OrgPermissionsGuard` with hierarchy checks and privilege escalation barriers.
   - Files: `backend/src/auth/guards/`.

5. **`TASK-CORE-05` (Students Hardening):**
   - Add lookup and update capabilities to `StudentsService` and `StudentsController`.
   - Files: `backend/src/students/`.

6. **`TASK-CORE-06` (Testing & Security Verification):**
   - Write unit tests for `UsersService`, `OrganizationsService`, `IdempotencyService`.
   - Write comprehensive security integration tests in `backend/test/security-core.e2e-spec.ts`.

7. **`TASK-CORE-07` (CI/CD Configuration & In-Module Documentation):**
   - Create `.github/workflows/ci.yml`.
   - Create `README.md`, `architecture.md`, and `security.md` inside `auth`, `users`, `organizations`, `students`, `ledger`.
