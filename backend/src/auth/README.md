# Auth Module — Surcos 360

## 1. Overview
El módulo `/auth` es el **núcleo de identidad y seguridad de la plataforma Surcos 360**, gobernado por el **PRD v1.0**.

Implementa una arquitectura de identidad desacoplada basada en `InstitutionalPerson`, registro institucional cerrado (`@colegiosurcos.edu.ec`), clasificación determinista de estudiantes (`*_est`), flujo criptográfico de invitación para representantes legales (`InvitationToken`), tokens seguros (SHA-256), sesiones con Supabase Auth, reautenticación para acciones sensibles, cambio/recuperación segura de contraseñas, auditoría inmutable (`AuditLog`) y autorización de tres capas.

---

## 2. Responsabilidades y Límites de Dominio

```text
Surcos 360 Identity ≠ Organization Membership ≠ Commercial Customer ≠ Commercial Supplier ≠ Permission Set
```

| Responsabilidad | Componente | Implementación |
|---|---|---|
| **Registro Institucional** | `AuthService` | Validación server-side de dominio `@colegiosurcos.edu.ec`, detección `*_est`, creación atómica de perfiles `StudentProfile`/`TeacherProfile`/`AuthorityProfile`, `StudentAccount` y `Customer`. |
| **Registro de Representantes** | `AuthService` | Canje de token de uso único (48h), admite cualquier proveedor de correo, vincula `RepresentativeProfile` al `StudentProfile` del emisor. |
| **Invitación de Padres** | `AuthService` | Generación por parte del estudiante de token CSPRNG (256-bit) con hash SHA-256 persistido y metadatos firmados. |
| **Tokens Criptográficos** | `TokensService` | Generación CSPRNG, almacenamiento de hash SHA-256 unidireccional, consumo atómico SQL (`$executeRaw`), sanitización de metadatos públicos. |
| **Autenticación y Sesiones** | `SupabaseAuthService` | Integración con Supabase Auth Admin & Client, emisión de JWT, refresh token rotation, logout local y logout global. |
| **Reautenticación & Contraseñas** | `AuthService` | Revalidación de credenciales para acciones críticas, emisión de tokens temporales de reauth, cambio de clave con complejidad fuerte y recuperación anti-enumeración. |
| **Guard de Autenticación** | `JwtAuthGuard` | Verificación de firma JWT, expiración e inyección de contexto de usuario institucional. |
| **Guard de Roles Institucionales** | `RolesGuard` | Verificación de `UserType` (`STUDENT`, `TEACHER`, `AUTHORITY`, `REPRESENTATIVE`) y estado `ACTIVE`. |
| **Guard de Gobernanza PYME** | `OrgPermissionsGuard` | Validación de pertenencia (`Membership`), verificación de rol `ADMIN` (1 por PYME) o permisos modulares granulares (`inventory.*`, `sales.*`, etc.). |

---

## 3. Matriz de Endpoints y Contratos de la API

### Endpoints Públicos (Con Rate Limiting)
- `POST /api/v1/auth/register`: Registro institucional (`@colegiosurcos.edu.ec`).
- `POST /api/v1/auth/register-representative`: Registro de representantes mediante token de invitación (48h).
- `POST /api/v1/auth/tokens/verify`: Verificación de tokens de registro/invitación sin fugar metadatos sensibles.
- `POST /api/v1/auth/login`: Autenticación con email y contraseña, retorna tokens de sesión y perfil con membresías.
- `POST /api/v1/auth/refresh`: Renovación de sesión activa mediante refresh token.
- `POST /api/v1/auth/recover-password`: Solicitud de recuperación de contraseña con respuesta anti-enumeración.
- `POST /api/v1/auth/reset-password`: Restablecimiento de contraseña mediante token verificado.

### Endpoints Autenticados
- `GET /api/v1/auth/me`: Consulta de perfil institucional, perfiles especializados y membresías del usuario en sesión.
- `POST /api/v1/auth/invite-parent`: Generación de enlace de invitación por parte del estudiante autenticado.
- `POST /api/v1/auth/logout`: Cierre de sesión y revocación del JWT actual.
- `POST /api/v1/auth/logout-all`: Cierre global de todas las sesiones activas en todos los dispositivos.
- `POST /api/v1/auth/change-password`: Cambio de contraseña autenticado con validación de clave actual.
- `POST /api/v1/auth/reauthenticate`: Reautenticación con contraseña para operaciones sensibles.

### Endpoints Administrativos de Tokens (`AUTHORITY`, `TEACHER`)
- `POST /api/v1/auth/tokens`: Emisión de tokens de registro institucional.
- `GET /api/v1/auth/tokens`: Listado y auditoría de tokens emitidos.
- `PATCH /api/v1/auth/tokens/:id/revoke`: Revocación inmediata de tokens activos (`AUTHORITY`).

---

## 4. Documentación de Soporte
- [architecture.md](file:///home/juxnbernxrdo/Documentos/Surcos%20360/backend/src/auth/architecture.md): Diagramas de secuencia y flujo de identidad, registro e invitación.
- [security.md](file:///home/juxnbernxrdo/Documentos/Surcos%20360/backend/src/auth/security.md): Modelo de amenazas, controles OWASP/ASVS y mitigaciones.
