# Security Checklist — `/auth` Backend Module

## Security Verification Gate

| Status | Rule / Checklist Item | Verification Mechanism / Test |
|:---:|---|---|
| [ ] | **No User Enumeration** | `POST /auth/login` and `POST /auth/recover` return identical generic error/success responses regardless of whether the user email exists. |
| [ ] | **Token Hashing** | Plaintext tokens (`st_tok_...`) are never stored in the database. `RegistrationToken.tokenHash` stores `SHA256(token)`. |
| [ ] | **Token Expiration** | Tokens with `expiresAt < NOW()` are rejected automatically with a generic invalid token error. |
| [ ] | **Atomic Token Redemption** | Token redemption (`usesCount++`, status check, user creation, `InstitutionalPerson` update) occurs inside a Prisma `$transaction`. |
| [ ] | **Single-Use Enforced** | Single-use tokens (`maxUses = 1`) transition to `USED` status immediately upon redemption and reject subsequent attempts. |
| [ ] | **Rate Limiting & Throttling** | `@nestjs/throttler` protects `/auth/login`, `/auth/register`, and `/auth/tokens/verify` against brute-force attacks (max 5 req/min per IP). |
| [ ] | **Input Validation & Sanitization** | `ValidationPipe` with `{ whitelist: true, forbidNonWhitelisted: true }` prevents mass-assignment or prototype pollution. |
| [ ] | **Safe Error Responses** | Uncaught exceptions do not spill stack traces or internal DB details to the client. Structured JSON errors return standard format. |
| [ ] | **Secrets Management** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` loaded via `@nestjs/config` from `.env`, never hardcoded. |
| [ ] | **Session Lifecycle & Revocation** | `POST /auth/logout` revokes session via Supabase Admin API. Short JWT access token expiration configured for student roles. |
| [ ] | **Server-Side Authorization** | Client claims are ignored. Authorization enforced by NestJS `RolesGuard` and `OrgPermissionsGuard`. |
| [ ] | **PostgreSQL RLS Alignment** | Database transactions set JWT claims (`SET LOCAL request.jwt.claims`) to ensure Postgres RLS policies enforce row-level boundary. |
| [ ] | **Audit Logging** | All sensitive authentication and token events write an immutable entry to `AuditLog`. |
| [ ] | **No Client Parameter Bypasses** | User identity, user type, and role claims are resolved exclusively from backend JWT verification and database queries. |
| [ ] | **Identity Duplicate Prevention** | Pre-imported XLSX records (`InstitutionalPerson`) are linked via exact match on email/code; no duplicate records created. |
