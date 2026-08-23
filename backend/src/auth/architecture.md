# Auth Architecture & Flow Specifications — Surcos 360 (PRD v1.0)

## 1. Arquitectura de Identidad Desacoplada

```mermaid
graph TD
    U[Usuario Global: User] --> IP[Identidad Institucional: InstitutionalPerson]
    IP --> SP[StudentProfile / TeacherProfile / AuthorityProfile / RepresentativeProfile]
    IP --> SA[StudentAccount en Surcos Saving]
    IP --> M1[Membership en AgroRed]
    IP --> M2[Membership en Surcos Fit]
    IP --> C[Customer / Cliente en PYMES]
    IP --> S[Supplier / Proveedor en PYMES]
```

---

## 2. Flujo de Registro Institucional

```mermaid
sequenceDiagram
    autonumber
    actor Usuario as Miembro Institucional
    participant API as NestJS (/auth/register)
    participant AuthSvc as AuthService
    participant Supabase as SupabaseAuthService
    participant DB as PostgreSQL (Prisma $transaction)

    Usuario->>API: POST /auth/register (email @colegiosurcos.edu.ec, password, nombres...)
    API->>AuthSvc: Validar dominio institucional y patrón *_est
    AuthSvc->>Supabase: createUser(email, password)
    Supabase-->>AuthSvc: Supabase User { id }
    AuthSvc->>DB: BEGIN $transaction
    AuthSvc->>DB: INSERT InstitutionalPerson
    alt Es Estudiante (*_est)
        AuthSvc->>DB: INSERT StudentProfile (curso, tutor)
        AuthSvc->>DB: INSERT StudentAccount (Surcos Saving)
        AuthSvc->>DB: INSERT Customer Profile
    else Es Maestro / Autoridad
        AuthSvc->>DB: INSERT TeacherProfile / AuthorityProfile
    end
    AuthSvc->>DB: INSERT AuditLog (USER_REGISTERED)
    alt Error en Base de Datos
        DB-->>AuthSvc: ROLLBACK
        AuthSvc->>Supabase: deleteUser(id) [Rollback Compensatorio]
        AuthSvc-->>Usuario: Error 400/409
    else Éxito
        DB-->>AuthSvc: COMMIT
        AuthSvc-->>Usuario: 201 Created (Perfil Sanitizado)
    end
```

---

## 3. Flujo de Invitación y Registro de Representantes Legales (§3.4 PRD v1.0)

```mermaid
sequenceDiagram
    autonumber
    actor Estudiante as Estudiante (Student)
    participant API as NestJS (/auth/invite-parent)
    participant TokenSvc as TokensService
    participant DB as PostgreSQL (Prisma)
    actor Padre as Representante / Padre
    participant RepAuth as NestJS (/auth/register-representative)
    participant Supabase as SupabaseAuthService

    Estudiante->>API: POST /auth/invite-parent
    API->>TokenSvc: createToken(REPRESENTATIVE, maxUses: 1, 48h, studentId)
    TokenSvc->>TokenSvc: Generar CSPRNG 256 bits + SHA-256
    TokenSvc->>DB: INSERT RegistrationToken (tokenHash, expiresAt: +48h, status: ACTIVE)
    TokenSvc-->>Estudiante: URL Segura (/auth/register-representative?token=st_tok_...)
    
    Estudiante->>Padre: Comparte enlace seguro
    Padre->>RepAuth: POST /auth/register-representative (token plano, email personal, password...)
    RepAuth->>TokenSvc: verifyToken(token plano)
    TokenSvc->>DB: Validar tokenHash, status == ACTIVE, expiresAt > NOW(), usesCount < maxUses
    RepAuth->>Supabase: createUser(email personal, password)
    RepAuth->>DB: BEGIN $transaction
    RepAuth->>TokenSvc: consumeToken(token plano, tx)
    Note over TokenSvc,DB: Atomic UPDATE SET usesCount=usesCount+1, status='USED'
    RepAuth->>DB: INSERT InstitutionalPerson (REPRESENTATIVE)
    RepAuth->>DB: INSERT RepresentativeProfile
    RepAuth->>DB: UPDATE StudentProfile SET representativeId = repProfile.id
    RepAuth->>DB: INSERT AuditLog (REPRESENTATIVE_REGISTERED)
    RepAuth->>DB: COMMIT
    RepAuth-->>Padre: 201 Created (Representante Vinculado al Estudiante)
```

---

## 4. Sesiones y Ciclo de Vida de Autenticación

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as Cliente Web
    participant Auth as NestJS (/auth/login, /auth/refresh, /auth/logout)
    participant Supabase as SupabaseAuthService
    participant DB as PostgreSQL (Prisma)

    Note over Cliente,Auth: 1. Inicio de Sesión
    Cliente->>Auth: POST /auth/login (email, password)
    Auth->>Supabase: signInWithPassword(email, password)
    Supabase-->>Auth: { accessToken, refreshToken, expiresIn, userId }
    Auth->>DB: findUnique InstitutionalPerson (status == ACTIVE)
    Auth->>DB: INSERT AuditLog (USER_LOGIN)
    Auth-->>Cliente: 200 OK { accessToken, refreshToken, userProfile, memberships }

    Note over Cliente,Auth: 2. Renovación de Sesión
    Cliente->>Auth: POST /auth/refresh (refreshToken)
    Auth->>Supabase: refreshSession(refreshToken)
    Supabase-->>Auth: { new accessToken, new refreshToken }
    Auth->>DB: INSERT AuditLog (TOKEN_REFRESH)
    Auth-->>Cliente: 200 OK { accessToken, refreshToken }

    Note over Cliente,Auth: 3. Cierre de Sesión (Local & Global)
    Cliente->>Auth: POST /auth/logout (JWT)
    Auth->>Supabase: signOut(jwtToken)
    Auth->>DB: INSERT AuditLog (USER_LOGOUT)
    Auth-->>Cliente: 200 OK (Sesión Cerrada)
```

---

## 5. Autorización de Tres Capas

```mermaid
graph LR
    Req[Petición Entrante] --> G1[Capa 1: JwtAuthGuard - Firma y Expiración JWT]
    G1 --> G2[Capa 2: RolesGuard - UserType Activo]
    G2 --> G3[Capa 3: OrgPermissionsGuard - Scope de PYME & Permisos Modulares]
    G3 --> Handler[Ejecución en Controlador / Servicio]
```
