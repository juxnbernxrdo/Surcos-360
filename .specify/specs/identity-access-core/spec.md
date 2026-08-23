# Functional Specification — Identity, Access & Institutional Governance Core

## 1. Context & Business Domain
According to **Surcos 360 PRD v4 (§4, §5, §10, §11, §13, §14)**, the **Identity, Access & Institutional Governance Core** is the security-critical backbone of the entire ecosystem. It establishes the uncompromised mapping between:
1. Physical Individuals (`InstitutionalPerson`)
2. Supabase Authentication Accounts (`User` via `userId`)
3. Academic Profiles (`StudentRecord`)
4. Multi-Organization Scopes (`Organization` & `Membership`)
5. Role-Based & Organization-Scoped Authorization (`Global Roles` vs `Organization Roles`)
6. Audit Trails (`AuditLog`)
7. Transactional Idempotency (`IdempotencyKey`)

---

## 2. System Actors & Authorization Matrix

```text
Actor / Scope          | Global Permission Scope          | Organization Permission Scope
-----------------------|----------------------------------|------------------------------
AUTHORITY / ADMIN      | Full Global Management           | Can supervise any Organization
TEACHER / TUTOR        | Read/Manage Assigned Courses     | VIEWER in PYMES by default
STUDENT                | Self-service only (/me/*)        | CUSTOMER (or EMPLOYEE/MANAGER if assigned)
PYME OWNER / MANAGER   | Standard institutional user      | Manage Products, Inventory, POS in Org
PYME EMPLOYEE          | Standard institutional user      | Register Sales, Check-in in Org
```

---

## 3. User Stories (IDs: `CORE-US-*`)

| ID | Title | Description | Acceptance Criteria |
|---|---|---|---|
| `CORE-US-01` | Exact XLSX Pre-Import Binding | As a pre-imported student/teacher, I want to redeem my token and register so my account links to my pre-existing institutional record without duplicate entries. | `AuthService.register()` matches `InstitutionalPerson` by exact code/email or token metadata and attaches `userId` atomically with zero duplicates. |
| `CORE-US-02` | User Profile & Lifecycle Management | As an Admin or User, I want to query and update profile status (ACTIVE, SUSPENDED, INACTIVE). | Admin can suspend/activate accounts; suspended accounts are rejected on login and token verification. |
| `CORE-US-03` | Organization Provisioning & Management | As an Admin, I want to create and configure organizations (e.g. AgroRed, Surcos Fit, Surcasino). | Unique code, name, description, isPyme flag, and audit log. |
| `CORE-US-04` | Membership Assignment & Offboarding | As an Org Owner or Admin, I want to add members, change roles, or revoke memberships. | Prevents vertical privilege escalation; records audit log; handles member offboarding safely. |
| `CORE-US-05` | Transactional Idempotency | As an API client, I want to supply `Idempotency-Key` headers on mutations so repeated requests do not duplicate financial or inventory effects. | Returns identical cached response for identical keys without re-executing business logic. |
| `CORE-US-06` | Unified Error Contract & Observability | As a client/developer, I want predictable JSON error responses with correlation IDs. | Global Exception Filter formats errors consistently with `requestId`, `timestamp`, `path`. |

---

## 4. Functional Requirements (IDs: `CORE-FR-*`)

- `CORE-FR-01`: **Deterministic Identity Resolution:**
  A person can have at most ONE `InstitutionalPerson` record across the institution. Supabase Auth `userId` must be uniquely attached.
- `CORE-FR-02`: **Privilege Escalation Protection:**
  An organization member cannot assign a role higher than their own (e.g., an `EMPLOYEE` cannot make someone `ADMIN` or `OWNER`).
- `CORE-FR-03`: **Token Security & Atomic Invalidation:**
  `RegistrationToken` is single-use, verified against expiration and state, hashed with SHA-256 in database, and atomically consumed via SQL conditional update.
- `CORE-FR-04`: **Student Operation Restrictions (3-Layer Enforcement):**
  Student users cannot mutate inventory, create sales, register purchases, or modify accounts. Enforced in UI, NestJS Guards, and Postgres RLS.
- `CORE-FR-05`: **Anti-User Enumeration:**
  Password recovery and token lookups return non-differentiating generic responses for non-existent accounts.
- `CORE-FR-06`: **Cross-Organization Tenant Isolation:**
  Requests targeting organization resources must validate `Membership` for `x-organization-id` or route params.

---

## 5. Non-Functional Requirements (IDs: `CORE-NFR-*`)
- `CORE-NFR-01`: **Security:** Zero plaintext credentials or tokens stored in DB. Strict Bearer JWT verification.
- `CORE-NFR-02`: **Observability:** Correlation ID / Request ID on every request, structured JSON logging, and complete `AuditLog` records for mutations.
- `CORE-NFR-03`: **CI/CD Quality:** All tests, linting, formatting, and builds must pass automated validation on every commit.
