# Task Breakdown — Surcos 360 V0

## Track A: Foundation & Setup
- [x] **TSK-A01:** Auditar repositorio y crear documento `.specify/memory/constitution.md`. [Db/Arch]
- [x] **TSK-A02:** Crear Especificación (`spec.md`), Plan (`plan.md`) y Checklist (`checklist.md`) en `.specify/specs/v0-walking-skeleton/`. [Arch]
- [ ] **TSK-A03:** Inicializar estructura del Monolito Modular en NestJS (`backend/`) y app Next.js (`frontend/`) si no están inicializadas. [Arch/Setup]
- [ ] **TSK-A04:** Definir `schema.prisma` completo con soporte para Identidad, Ledger, AgroRed, RLS y Auditoría. [Database]
- [ ] **TSK-A05:** Generar y ejecutar migración inicial de Prisma y scripts de políticas Postgres RLS. [Database/Security]

---

## Track B: Identity & Auth
- [ ] **TSK-B01:** Crear `RegistrationToken` schema y servicio con hashing de token y caducidad. [Backend/Security]
- [ ] **TSK-B02:** Implementar servicio de importación CSV de estudiantes con match exacto (`InstitutionalPerson` + `StudentRecord`). [Backend/Identity]
- [ ] **TSK-B03:** Implementar endpoint de canje de token y vinculación con Supabase Auth `User`. [Backend/Auth]
- [ ] **TSK-B04:** Crear UI de Registro / Canje de Token en Next.js con feedback visual de error/éxito. [Frontend/UX]

---

## Track C: Authorization & RLS
- [ ] **TSK-C01:** Implementar NestJS Guards y Decorators para permisos globales y por Organización. [Backend/Security]
- [ ] **TSK-C02:** Configurar interceptor Prisma para inyectar claims JWT del usuario (`SET LOCAL request.jwt.claims`). [Backend/Database]
- [ ] **TSK-C03:** Escribir y aplicar políticas RLS en Postgres para denegar acceso de escritura a `STUDENT`. [Database/Security]

---

## Track D: Finance & Double-Entry Ledger
- [ ] **TSK-D01:** Crear módulo `Ledger` con servicio para transacciones de partida doble ($\sum \text{DEBIT} = \sum \text{CREDIT}$). [Backend/Finance]
- [ ] **TSK-D02:** Implementar creación automática de `StudentAccount` y movimiento `INITIAL_BALANCE`. [Backend/Finance]
- [ ] **TSK-D03:** Implementar middleware/interceptor de Idempotencia basado en header `Idempotency-Key`. [Backend/Security]
- [ ] **TSK-D04:** Crear UI de Dashboard del Estudiante (`/student/dashboard`) en Next.js con saldo, gastos e historial. [Frontend/UX]

---

## Track E: AgroRed (PYME), Inventario & WAC
- [ ] **TSK-E01:** Crear módulo `AgroRed` con CRUD de Productos, Inventarios y Proveedores. [Backend/Domain]
- [ ] **TSK-E02:** Implementar registro de Compras a Proveedores con recálculo de WAC y locking `FOR UPDATE`. [Backend/Domain]
- [ ] **TSK-E03:** Implementar registro atómico de Ventas (deducción stock WAC + asiento contable + `SaleItem` + `AuditLog`). [Backend/Domain]
- [ ] **TSK-E04:** Crear pantallas de gestión de AgroRed en Next.js (Productos, Inventario, Compras, Ventas) con Emil Kowalski UX & Motion. [Frontend/UX]

---

## Track F: Audit & Verification
- [ ] **TSK-F01:** Implementar `AuditModule` e interceptor para registro inmutable en `AuditLog`. [Backend/Audit]
- [ ] **TSK-F02:** Escribir pruebas unitarias e integración para Ledger, WAC y bloqueo RLS. [Testing]
- [ ] **TSK-F03:** Ejecutar análisis SDD (`/speckit.analyze`) y verificación final (`/speckit.converge`). [Quality]
