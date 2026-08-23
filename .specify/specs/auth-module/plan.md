# Technical Plan & API Contract — `/auth` Backend Module

## 1. Architecture Overview (NestJS Monolith)

The `/auth` backend module will be implemented within the NestJS backend under `backend/src/auth/`.

```text
backend/src/auth/
  ├── dto/
  │   ├── login.dto.ts
  │   ├── register.dto.ts
  │   ├── create-token.dto.ts
  │   ├── verify-token.dto.ts
  │   └── recover-password.dto.ts
  ├── guards/
  │   ├── jwt-auth.guard.ts
  │   ├── roles.guard.ts
  │   └── org-permissions.guard.ts
  ├── decorators/
  │   ├── roles.decorator.ts
  │   ├── org-permissions.decorator.ts
  │   └── current-user.decorator.ts
  ├── strategies/
  │   └── jwt.strategy.ts
  ├── services/
  │   ├── auth.service.ts
  │   ├── tokens.service.ts
  │   └── supabase-auth.service.ts
  ├── controllers/
  │   ├── auth.controller.ts
  │   └── tokens.controller.ts
  └── auth.module.ts
```

---

## 2. Component Responsibilities

### 2.1 Services
* **`SupabaseAuthService`**: Wrapper over `@supabase/supabase-js`.
  - `createUser(email, password)`: Calls `supabase.auth.admin.createUser()` via `SUPABASE_SERVICE_ROLE_KEY`.
  - `signIn(email, password)`: Calls `supabase.auth.signInWithPassword()`.
  - `signOut(jwt)`: Calls `supabase.auth.admin.signOut(jwt)`.
  - `resetPassword(email)`: Calls `supabase.auth.resetPasswordForEmail()`.
* **`TokensService`**:
  - `createToken(dto, actorId)`: Generates cryptographically secure random token (`st_tok_<random32>`), computes SHA-256 `tokenHash`, persists to Prisma `RegistrationToken`.
  - `verifyToken(rawToken)`: Hashes token, queries Prisma, validates status (`ACTIVE`), expiry (`expiresAt > now`), and `usesCount < maxUses`.
  - `redeemToken(rawToken, tx)`: Increments `usesCount`, updates status to `USED` if `usesCount >= maxUses`.
  - `revokeToken(tokenId, actorId)`: Updates status to `REVOKED`.
* **`AuthService`**:
  - Orchestrates register, login, logout, profile resolution.
  - Performs exact matching between redeemed token metadata and `InstitutionalPerson`.
  - Emits `AuditLog` records for all auth operations.

### 2.2 Guards & Strategies
* **`JwtStrategy`**: Extracted from `Authorization: Bearer <token>` header. Validates JWT signature against Supabase JWT Secret (`SUPABASE_JWT_SECRET`).
* **`JwtAuthGuard`**: Protects endpoints requiring authentication. Attaches `InstitutionalPerson` profile to `req.user`.
* **`RolesGuard`**: Checks `@Roles(UserType.STUDENT, ...)` against `req.user.institutionalPerson.userType`.
* **`OrgPermissionsGuard`**: Checks `@OrgPermissions(OrganizationRole.ADMIN, ...)` against `req.user.memberships`.

---

## 3. Database Schema & Transaction Strategy

### 3.1 Prisma Models Referenced
* `RegistrationToken`
* `InstitutionalPerson`
* `StudentRecord`
* `User` (Supabase Auth reference via `userId`)
* `Membership`
* `Organization`
* `AuditLog`

### 3.2 Remediation Transaction Integrity for Token Redemption (`POST /auth/register`)
To eliminate race conditions, double redemption of tokens, and orphan Supabase Auth users:
```typescript
// 1. Atomic token usage increment via conditional UPDATE (Prevents Double-Spend Race Condition)
const tokenHash = this.tokensService.hashToken(dto.token);

const updatedCount = await this.prisma.$executeRaw`
  UPDATE "RegistrationToken"
  SET "usesCount" = "usesCount" + 1,
      "status" = CASE WHEN "usesCount" + 1 >= "maxUses" THEN 'USED'::"TokenStatus" ELSE 'ACTIVE'::"TokenStatus" END
  WHERE "tokenHash" = ${tokenHash}
    AND "status" = 'ACTIVE'
    AND "expiresAt" > NOW()
    AND "usesCount" < "maxUses"
`;

if (updatedCount === 0) {
  throw new BadRequestException('Invalid, expired, or fully consumed registration token');
}

// 2. Fetch validated token details
const tokenRecord = await this.prisma.registrationToken.findUnique({
  where: { tokenHash },
});

// 3. Create Supabase Auth User
const supabaseUser = await this.supabaseAuth.createUser(dto.email, dto.password);

try {
  // 4. Link or Create InstitutionalPerson inside DB transaction
  return await this.prisma.$transaction(async (tx) => {
    let person = await tx.institutionalPerson.findFirst({
      where: {
        AND: [
          { email: dto.email },
          { institutionalCode: dto.institutionalCode }
        ]
      },
    });

    if (person) {
      if (person.userId) {
        throw new ConflictException('Institutional person is already linked to a user account');
      }
      person = await tx.institutionalPerson.update({
        where: { id: person.id },
        data: { userId: supabaseUser.id },
      });
    } else {
      person = await tx.institutionalPerson.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          institutionalCode: dto.institutionalCode,
          userType: (tokenRecord.type as UserType) || UserType.STUDENT,
          userId: supabaseUser.id,
          studentRecord: tokenRecord.type === 'STUDENT' ? {
            create: { course: dto.course || 'Unassigned', tutor: dto.tutor }
          } : undefined,
        },
      });
    }

    // 5. Create Audit Log
    await tx.auditLog.create({
      data: {
        actorId: person.id,
        action: 'USER_REGISTERED',
        entity: 'InstitutionalPerson',
        entityId: person.id,
        newState: { userId: supabaseUser.id, tokenType: tokenRecord.type },
        ipAddress,
        userAgent,
      },
    });

    return person;
  });
} catch (error) {
  // Rollback Compensation: Delete created Supabase Auth user if DB transaction fails
  await this.supabaseAuth.deleteUser(supabaseUser.id);
  throw error;
}
```

---

## 4. API Contract (Endpoints Specification)

### Endpoint 1: `POST /auth/register`
* **Method & Path:** `POST /api/v1/auth/register`
* **Actor:** Unauthenticated User
* **Auth Required:** None
* **Rate Limit:** 5 requests / min per IP
* **Request Body:**
```json
{
  "token": "st_tok_7a9f8b2c4e1d...",
  "email": "student@surcos.edu.ec",
  "password": "SecurePassword123!",
  "firstName": "Juan",
  "lastName": "Pérez",
  "institutionalCode": "EST-2026-001",
  "course": "3ro BGU"
}
```
* **Response (201 Created):**
```json
{
  "statusCode": 201,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "uuid-institutional-person-id",
      "email": "student@surcos.edu.ec",
      "firstName": "Juan",
      "lastName": "Pérez",
      "userType": "STUDENT"
    }
  }
}
```
* **Errors:**
  - `400 Bad Request`: Invalid DTO, invalid/expired token.
  - `409 Conflict`: Email or institutional code already linked.
  - `429 Too Many Requests`: Rate limit exceeded.

---

### Endpoint 2: `POST /auth/login`
* **Method & Path:** `POST /api/v1/auth/login`
* **Actor:** User
* **Auth Required:** None
* **Rate Limit:** 5 requests / min per IP
* **Request Body:**
```json
{
  "email": "student@surcos.edu.ec",
  "password": "SecurePassword123!"
}
```
* **Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1Ni...",
    "refreshToken": "v1.N2Q...",
    "expiresIn": 900,
    "user": {
      "id": "uuid-institutional-person",
      "userId": "uuid-supabase-user",
      "email": "student@surcos.edu.ec",
      "firstName": "Juan",
      "lastName": "Pérez",
      "status": "ACTIVE",
      "memberships": []
    }
  }
}
```
* **Errors:**
  - `401 Unauthorized`: `"Invalid email or password"` (Anti-User Enumeration).
  - `429 Too Many Requests`: Rate limit exceeded.

---

### Endpoint 3: `POST /auth/logout`
* **Method & Path:** `POST /api/v1/auth/logout`
* **Actor:** Authenticated User
* **Auth Required:** Bearer JWT Token
* **Request Body:** `{}`
* **Response (200 OK):**
```json
{
  "statusCode": 200,
  "message": "Logout successful"
}
```

---

### Endpoint 4: `GET /auth/me`
* **Method & Path:** `GET /api/v1/auth/me`
* **Actor:** Authenticated User
* **Auth Required:** Bearer JWT Token
* **Response (200 OK):** Returns full `InstitutionalPerson` profile, `StudentRecord` (if student), and array of active `Memberships` with organization roles.

---

### Endpoint 5: `POST /auth/tokens`
* **Method & Path:** `POST /api/v1/auth/tokens`
* **Actor:** Global Admin / Organization Admin
* **Auth Required:** Bearer JWT Token (`@Roles` or `@OrgPermissions`)
* **Request Body:**
```json
{
  "type": "STUDENT",
  "maxUses": 1,
  "expiresInDays": 7,
  "metadata": {
    "course": "3ro BGU"
  }
}
```
* **Response (201 Created):**
```json
{
  "statusCode": 201,
  "message": "Registration token generated successfully",
  "data": {
    "id": "uuid-token-id",
    "token": "st_tok_7a9f8b2c4e1d...",
    "type": "STUDENT",
    "status": "ACTIVE",
    "maxUses": 1,
    "expiresAt": "2026-08-18T12:00:00.000Z"
  }
}
```
* **Note:** `data.token` is returned ONLY ONCE upon creation. The database stores SHA-256 hash.

---

### Endpoint 6: `POST /auth/tokens/verify`
* **Method & Path:** `POST /api/v1/auth/tokens/verify`
* **Actor:** Unauthenticated User (Frontend registration form load)
* **Request Body:** `{ "token": "st_tok_7a9f8b2c4e1d..." }`
* **Response (200 OK):**
```json
{
  "statusCode": 200,
  "valid": true,
  "type": "STUDENT",
  "metadata": { "course": "3ro BGU" }
}
```
* **Error (400 Bad Request):** Generic `"Invalid or expired registration token"`.

---

### Endpoint 7: `PATCH /auth/tokens/:id/revoke`
* **Method & Path:** `PATCH /api/v1/auth/tokens/:id/revoke`
* **Actor:** Global Admin
* **Auth Required:** Bearer JWT Token (`@Roles(UserType.AUTHORITY)`)
* **Response (200 OK):** Token status updated to `REVOKED`, logged in `AuditLog`.

---

## 5. Security Architecture & RLS Matrix

### Responsibilities
| Security Dimension | Responsibilities | Implementation |
|---|---|---|
| **Authentication (Who are you?)** | Supabase Auth + JWT Strategy | Validates signature & expiration |
| **Business Guards (What can you do in NestJS?)** | NestJS Guards & Decorators | `@UseGuards(JwtAuthGuard, RolesGuard)` |
| **Data RLS (What rows can you access in Postgres?)** | PostgreSQL Row Level Security | Policies checking `auth.uid()` / JWT claims |

### Postgres RLS Integration Rule (Constitution §3.2)
When NestJS performs database queries on behalf of an authenticated user, it configures Prisma transactions with:
```sql
SET LOCAL request.jwt.claims = '{"sub": "<userId>", "role": "authenticated"}';
```
This ensures Postgres RLS evaluates `auth.uid()` as the actual user rather than bypassing RLS as superuser.
