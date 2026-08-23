# Implementation Plan (plan.md)
## Surcos 360 — General Ledger & Financial Engine

**Documento:** `.specify/specs/ledger-financial-engine/plan.md`  
**Versión:** 2.0  

---

## 1. Fases de Ejecución

### Fase 1: Especificación y Contratos SDD
* Elaboración y validación de `spec.md`, `architecture.md`, `accounting-rules.md`, `ledger-invariants.md`.
* Definición de contratos DTO y tipos de datos numéricos exactos (`MoneyUtil`, `@IsMoney`).

### Fase 2: Modelo de Datos y Esquema Prisma
* Esquema canónico en raíz `prisma/schema.prisma`.
* Entidades contables: `Transaction`, `LedgerEntry`, `LedgerAccount`, `StudentAccount`.
* Índices compuestos para alto rendimiento en consultas de cartola y balance.
* Migración base con triggers PostgreSQL para forzar inmutabilidad append-only.

### Fase 3: Núcleo del Motor Contable (`LedgerService`)
* Transaccionalidad atómica unificada con soporte de `runInTx`.
* Validación matemática de partida doble ($\sum \text{Dr} = \sum \text{Cr}$, montos $> 0$, $\ge 2$ asientos).
* Idempotencia atómica basada en bloqueos de asesoría transaccionales (`pg_advisory_xact_lock`).
* Bloqueo pesimista de billeteras (`SELECT ... FOR UPDATE`).
* Reversión de transacciones (`reversalOfId`) y bloqueo de doble reversión.
* Agregación por lotes de saldos de cuentas estudiantiles y de libro mayor.

### Fase 4: Servicios Financieros y Reportes
* `FinancialAccountsService`: Declaración de saldos y extractos de cuenta.
* `FinancialReportsService`: Balance de Comprobación, Estado de Resultados, Balance General y Resumen Institucional.
* Centralización de analítica estudiantil en `StudentAnalyticsService`.

### Fase 5: Integración Comercial y Concurrencia
* Integración de Ventas POS, Compras WAC, Alquileres de Surcasino, Visitas de Surcos Fit y Gastos Operativos.
* Conexión con `AuditLog` sincrónico.

### Fase 6: Pruebas, Verificación y Auditoría
* Pruebas unitarias de reglas contables y utilidades de dinero.
* Pruebas de integración contra PostgreSQL real (Docker) para concurrencia, doble gasto, idempotencia e inmutabilidad.
* Pruebas e2e de seguridad y aislamiento multi-tenant.