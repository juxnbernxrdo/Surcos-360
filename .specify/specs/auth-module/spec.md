# Specification — `/auth` Backend Module (Surcos 360)

## 1. Executive Summary & Purpose
The `/auth` backend module is the identity gateway and security foundation for **Surcos 360**. It handles user registration via secure polymorphic `RegistrationTokens`, account authentication integrated with **Supabase Auth**, session management, and deterministic identity linkage to `InstitutionalPerson` records.

This module guarantees strict adherence to the **Constitution** (§2 Identity, §3 Security in 3 Layers, §6 Audit) and **PRD v4** (§4 Identity Model & Tokens, §11 Security).

---

## 2. Actors & Scopes

| Actor | Description | Privileges in `/auth` |
|---|---|---|
| **Global Admin (Surcos Saving Admin)** | System administrator in Surcos Saving | Can create, issue, list, and revoke `RegistrationToken`s. Can manage/suspend `InstitutionalPerson` accounts and assign global/organization roles. |
| **Pyme Manager / Owner** | Manager of an Organization (e.g. AgroRed) | Can issue `RegistrationToken` of type `PYME_MEMBER` for their organization. |
| **Pre-imported Student / User** | `InstitutionalPerson` imported via XLSX without a `User` auth account | Receives a `RegistrationToken` to complete sign-up and link their Supabase Auth account. |
| **New User (Student / Teacher / Rep / Auth)** | Unregistered individual | redeems a `RegistrationToken` to create a Supabase Auth `User` and link to their `InstitutionalPerson`. |
| **Authenticated User** | User with valid Supabase Auth JWT | Can view own identity profile (`/auth/me`), manage active session, or trigger logout. |

---

## 3. Core Functional Domains & Requirements

### 3.1 Registration Token System (`RegistrationToken`)
* **Polymorphic Token Table:** `RegistrationToken` schema supports token types: `STUDENT`, `TEACHER`, `AUTHORITY`, `REPRESENTATIVE`, `PYME_MEMBER`.
* **Hash-Only Storage:** Plaintext tokens are NEVER stored in the database. Only `tokenHash` (SHA-256 of the token string) is saved.
* **Token Validation Rules:**
  1. Token hash must exist.
  2. `status` must be `ACTIVE`.
  3. `expiresAt` must be in the future (`expiresAt > NOW()`).
  4. `usesCount < maxUses` (supports single-use `maxUses = 1` or controlled multi-use).
* **Token Metadata Payload (`metadata` JSONB):**
  - For `STUDENT`: `{ institutionalPersonId: string, course: string, tutor?: string }`
  - For `PYME_MEMBER`: `{ organizationId: string, role: OrganizationRole }`
* **Expiration & Revocation:** Admin can revoke tokens (`status = REVOKED`). Expired tokens automatically fail validation (`status = EXPIRED` or runtime timestamp check).

### 3.2 Identity Linkage & Prevention of Duplicates
* **Model Hierarchy:**
  $$\text{InstitutionalPerson} \xrightarrow{\text{userId?}} \text{User (Supabase Auth)} \xrightarrow{} \text{StudentRecord / Customer / Memberships}$$
* **Exact Matching Linkage Flow:**
  - When an XLSX file is imported, an `InstitutionalPerson` is created with `userId = NULL` and a designated `userType` (`STUDENT`, `TEACHER`, `AUTHORITY`, `REPRESENTATIVE`).
  - When redeeming a token with `institutionalPersonId` in metadata (or matching exact `email` AND `institutionalCode`), the `/auth/register` endpoint binds `userId = supabaseUser.id`.
  - If no `InstitutionalPerson` exists yet for a non-imported user, one is created with strict unique constraints on `email` and `institutionalCode`.
* **Duplicate Prevention:** Unique indexes on `InstitutionalPerson.email`, `InstitutionalPerson.institutionalCode`, and `InstitutionalPerson.userId`. If a duplicate is detected, the transaction aborts with a safe conflict error.
* **Atomic Token Consumption & Concurrency Control:** Token redemption (`usesCount++`, status updates) MUST be executed atomically using conditional database updates (`UPDATE WHERE usesCount < maxUses`) to prevent double-spending race conditions.
* **Auth Transactional Rollback Safety:** If Prisma database creation/linking fails, any newly created Supabase Auth user MUST be compensated via instant deletion (`supabaseAdmin.auth.admin.deleteUser`).

### 3.3 Authentication & Session Management
* **Supabase Auth Integration:**
  - NestJS relies on Supabase Auth as the primary IDP for credential storage, password hashing, and JWT token issuance.
  - NestJS validates Supabase JWTs on protected endpoints using a Passport JWT strategy (`JwtAuthGuard`).
  - NestJS extracts `sub` (Supabase `userId`), `email`, and queries `InstitutionalPerson` to attach identity claims to `req.user`.
* **Login Flow (`/auth/login`):**
  - Accepts `email` and `password`.
  - Authenticates against Supabase Auth API (`signInWithPassword`).
  - Returns access token, refresh token, session expiry, and user identity profile (`InstitutionalPerson` + roles).
* **Logout & Revocation (`/auth/logout`):**
  - Calls Supabase Auth sign-out.
  - Invalidates active session.
  - Logs `LOGOUT` in `AuditLog`.
* **Session Lifecycle on Shared Computers (PRD §11.3):**
  - Access token expiration default: 15 minutes (or 1 hour configurable).
  - Short session duration enforced for `STUDENT` role on shared laboratory computers.
  - `rememberMe: false` enforced by default for `STUDENT`.

### 3.4 Password Recovery & Identity Verification (`/auth/recover`)
* Delegates email recovery token generation to Supabase Auth (`resetPasswordForEmail`).
* Does NOT reveal whether the email exists in the database (Anti-User Enumeration). Always returns a generic success message: `"If an account with that email exists, password reset instructions have been sent."`

### 3.5 Roles & Authorization Limits
* **Global Permissions vs Organization Permissions:**
  - `InstitutionalPerson` defines global user type (`STUDENT`, `TEACHER`, `REPRESENTATIVE`, `AUTHORITY`).
  - `Membership` defines organization role (`OWNER`, `ADMIN`, `MANAGER`, `EMPLOYEE`, `VIEWER`).
* **NestJS Authorization Boundary:**
  - `/auth` endpoints issue identity claims and provide `@Roles()` and `@OrgPermissions()` decorators for NestJS Guards across all domain modules.
  - `STUDENT` type is strictly restricted from performing administrative/financial token creation or elevated role management.

### 3.6 Security, Audit & Abuse Protection
* **Anti-User Enumeration:** Login, registration, token verification, and password reset endpoints respond with generic error messages (`"Invalid credentials or token"`) to prevent email harvesting.
* **Rate Limiting & Throttling:**
  - Endpoints `/auth/login`, `/auth/register`, and `/auth/tokens/verify` are protected by `@nestjs/throttler` (e.g. max 5 attempts per minute per IP).
  - Failed token redemption attempts trigger progressive throttling.
* **Audit Logging (`AuditLog`):**
  - Mandatory audit entries for: `TOKEN_CREATED`, `TOKEN_REVOKED`, `TOKEN_REDEEMED`, `USER_REGISTERED`, `USER_LOGIN`, `USER_LOGOUT`, `USER_SUSPENDED`.
  - Includes `actorId`, `action`, `entity`, `entityId`, `ipAddress`, `userAgent`, `timestamp`.
* **Input Validation:** Every endpoint enforces strict DTO validation using `class-validator` and `class-transformer`. Unexpected parameters are stripped (`whitelist: true`, `forbidNonWhitelisted: true`).

---

## 4. Requirement Traceability Matrix (PRD v4)

| PRD Section | Requirement Description | Spec Section | Target Verification |
|---|---|---|---|
| PRD §4.4 | Registration with any valid email | §3.2 | DTO `@IsEmail()`, Supabase Auth creation |
| PRD §4.5 | Polymorphic `RegistrationToken` (hash, status, maxUses, metadata) | §3.1 | Prisma `RegistrationToken` schema & validation service |
| PRD §4.1 - §4.3 | Identity model (`InstitutionalPerson` -> `User` -> `StudentRecord`) | §3.2 | Exact match linkage test |
| PRD §11.3 | Shared computer session security | §3.3 | JWT expiration & non-persistent session flag |
| PRD §11.7 | Rate limiting & brute force protection | §3.6 | NestJS `@nestjs/throttler` integration tests |
| PRD §14.1 | Audit logging for sensitive auth actions | §3.6 | `AuditLog` creation check on register/login/token |
