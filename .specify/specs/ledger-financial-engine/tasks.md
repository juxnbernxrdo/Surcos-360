# Implementation Tasks (tasks.md)
## Surcos 360 — General Ledger & Financial Engine

**Documento:** `.specify/specs/ledger-financial-engine/tasks.md`  
**Versión:** 2.0  

---

## Tareas de Implementación y Verificación

- [x] **`TASK-LDG-01`**: Unificar esquema Prisma raíz (`prisma/schema.prisma`), eliminar copias locales obsoletas y configurar `prisma.config.ts`.
- [x] **`TASK-LDG-02`**: Incorporar campos de metadata/moneda e índices en `Transaction` y `LedgerEntry`; generar migración con triggers append-only (`prevent_ledger_mutation`).
- [x] **`TASK-LDG-03`**: Implementar capa monetaria exacta (`MoneyUtil`, decorador `@IsMoney()`) con tipos string en DTOs para eliminar floats en la frontera.
- [x] **`TASK-LDG-04`**: Endurecer el núcleo de `LedgerService` con soporte `runInTx`, validación de partida doble ($\sum \text{Dr} = \sum \text{Cr}$), y advisory lock para idempotencia.
- [x] **`TASK-LDG-05`**: Implementar bloqueo pesimista `lockStudentAccount` (`SELECT ... FOR UPDATE`) para evitar double-spending TOCTOU.
- [x] **`TASK-LDG-06`**: Implementar motor de reversiones atómicas inmutables con validación de no doble-reversión.
- [x] **`TASK-LDG-07`**: Implementar derivación de saldos por lotes (`getStudentAccountBalances`, `getLedgerAccountBalances`) para optimizar rendimiento.
- [x] **`TASK-LDG-08`**: Integrar módulos comerciales (Ventas POS, Compras WAC, Surcasino Rentals, Surcos Fit Gym, Gastos) al ledger con locks de fila y referencias completas.
- [x] **`TASK-LDG-09`**: Configurar driver adapter `@prisma/adapter-pg` en `PrismaService` para soportar conectividad nativa y transacciones seguras.
- [x] **`TASK-LDG-10`**: Implementar suite de pruebas unitarias (127 pruebas) para reglas contables, DTOs y validaciones.
- [x] **`TASK-LDG-11`**: Implementar suite de pruebas de integración contra PostgreSQL real en Docker (9 pruebas: partida doble, doble gasto concurrente, advisory lock idempotente, trigger append-only).
- [x] **`TASK-LDG-12`**: Implementar suite de pruebas e2e (58 pruebas) de seguridad, aislamiento de organizaciones y control de acceso.
- [x] **`TASK-LDG-13`**: Ejecución del pipeline de verificación completo (Lint, TypeScript compilation, Unit Tests, Integration Tests, E2E Tests).