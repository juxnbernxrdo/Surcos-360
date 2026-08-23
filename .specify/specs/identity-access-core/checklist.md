# Production Readiness Checklist — Identity, Access & Governance Core

## 1. Security & Authorization
- [ ] No duplicate `InstitutionalPerson` records created across registration and import flows.
- [ ] Role escalation prevented: Org members cannot assign roles higher than their own.
- [ ] All sensitive endpoints protected by `JwtAuthGuard` + `RolesGuard` / `OrgPermissionsGuard`.
- [ ] Suspended accounts (`status: SUSPENDED`) blocked from authenticating or accessing endpoints.
- [ ] Throttling / Rate limiting active on global and authentication routes.
- [ ] Sensitive tokens hashed with SHA-256; zero plaintext secrets in database.
- [ ] Anti-user enumeration verified on password recovery.

## 2. Data Integrity & Concurrency
- [ ] `IdempotencyInterceptor` stores and serves identical responses for matching `Idempotency-Key`.
- [ ] Unique constraints enforced on `email`, `institutionalCode`, `(organizationId, code)`, `(institutionalPersonId, organizationId)`.
- [ ] Atomic transactions used on all mutation flows with rollback compensation.

## 3. Observability & Error Handling
- [ ] Global `HttpExceptionFilter` formats errors uniformly.
- [ ] Audit logs recorded for user status changes, membership creations/deletions, role updates, and org creations.

## 4. Testing & CI/CD
- [ ] Unit test suite covering `UsersService`, `OrganizationsService`, `IdempotencyService`, `AuthService`, `TokensService`, `StudentsService`, `LedgerService`.
- [ ] Security E2E tests validating horizontal and vertical privilege escalation rejection.
- [ ] GitHub Actions CI workflow configured.
- [ ] In-module technical documentation created.
