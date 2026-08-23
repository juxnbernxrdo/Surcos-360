# Auth Security Guide & Threat Model — Surcos 360 (PRD v1.0)

## 1. Modelo de Amenazas (Threat Model)

### Activos Críticos
- Cuentas de usuario y credenciales.
- Identidades institucionales (`InstitutionalPerson`, `StudentProfile`, `TeacherProfile`, `AuthorityProfile`, `RepresentativeProfile`).
- Cuentas financieras de estudiantes (`StudentAccount`).
- Sesiones activas (JWT de Supabase, tokens de renovación).
- Tokens criptográficos de registro e invitación (`RegistrationToken`).
- Membresías y permisos de PYMES (`Membership`).
- Pistas de auditoría inmutables (`AuditLog`).

### Actores de Amenaza y Vectores de Ataque
- **Atacante No Autenticado**: Fuerza bruta, credential stuffing, enumeración de usuarios, adivinación de tokens, reutilización maliciosa de enlaces de invitación o timing attacks.
- **Estudiante Malicioso / Manipulado**: Escalación vertical de privilegios (crear tokens de autoridad, alterar roles de PYMES, consultar saldos ajenos), acceso cross-tenant no autorizado.
- **Tercero no Vinculado**: Intento de suplantación de representante legal sin token de invitación legítimo.

---

## 2. Matriz de Mitigación OWASP & ASVS

| Amenaza / Vulnerabilidad | Estándar OWASP / ASVS | Severidad | Mitigación Implementada | Prueba de Verificación |
|---|---|---|---|---|
| **Escalación Vertical de Privilegios en Tokens** | OWASP API5:2023 / CWE-285 | **P0 Crítica** | `@Roles(UserType.AUTHORITY, UserType.TEACHER)` forzado a nivel de guard en endpoints de emisión administrativa. | `auth.e2e-spec.ts` (Estudiante rechazado con 403) |
| **Abuso / Suplantación de Representantes** | OWASP API3:2023 / CWE-287 | **P0 Crítica** | Tokens CSPRNG de 256 bits, solo 48h de vigencia, uso único estricto (`maxUses: 1`), derivación inequívoca del `studentId`. | `auth.service.spec.ts`, `auth.e2e-spec.ts` |
| **Replay Attack & Race Condition en Tokens** | OWASP ASVS V3 / CWE-362 | **P1 Alta** | Actualización condicional atómica SQL (`$executeRaw` con `usesCount < maxUses AND status = 'ACTIVE'`). | `tokens.service.spec.ts` |
| **Inconsistencia por Fallo Parcial de Registro** | CWE-662 / Atomicidad | **P1 Alta** | Transacción ACID con Prisma. En caso de error, compensación y borrado inmediato del usuario en Supabase Auth (`deleteUser`). | `auth.service.spec.ts` |
| **Enumeración de Cuentas (CWE-204)** | OWASP API8:2023 / CWE-204 | **P2 Media** | Respuestas genéricas idénticas y rate limiting en recuperación de contraseñas (`/auth/recover-password`). | `security-core.e2e-spec.ts` |
| **Fuga de Metadatos Sensibles en Verificación** | OWASP API1:2023 / CWE-200 | **P2 Media** | Sanitización explícita en `/auth/tokens/verify` filtrando IDs internos y hashes. | `tokens.service.spec.ts` |
| **Fuerza Bruta & Credential Stuffing** | OWASP API2:2023 / CWE-307 | **P1 Alta** | Rate limiting estricto con `@nestjs/throttler` en `/auth/login`, `/auth/register`, `/auth/recover-password`. | `auth.controller.ts` |
| **Acceso desde Cuentas Suspendidas** | OWASP ASVS V3 / CWE-284 | **P1 Alta** | Verificación de `status === ACTIVE` en login, refresh, `JwtAuthGuard`, `RolesGuard` y `OrgPermissionsGuard`. | `security-core.e2e-spec.ts` |
| **Operaciones Sensibles sin Verificación** | OWASP ASVS V3 / CWE-308 | **P2 Media** | Endpoint `/auth/reauthenticate` para validar contraseña actual antes de operaciones críticas. | `auth.service.spec.ts`, `auth.e2e-spec.ts` |

---

## 3. Ciclo de Vida Criptográfico de Tokens
1. **Generación**: 32 bytes aleatorios criptográficamente seguros mediante `crypto.randomBytes(32)` (256 bits de entropía), formateados como `st_tok_<hex>` o `sec_tok_<hex>`.
2. **Almacenamiento**: Exclusivamente se almacena el hash unidireccional SHA-256 (`crypto.createHash('sha256')`). El token en texto plano jamás se guarda en base de datos.
3. **Canje Atómico**: Búsqueda por hash, consumo atómico con `$executeRaw` dentro de la transacción de Prisma, invalidando el token inmediatamente tras su primer uso.
