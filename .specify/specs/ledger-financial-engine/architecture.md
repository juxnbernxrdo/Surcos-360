# Architecture Document (architecture.md)
## Surcos 360 — General Ledger & Financial Engine Architecture

**Documento:** `.specify/specs/ledger-financial-engine/architecture.md`  
**Versión:** 2.0  
**Stack:** Next.js · NestJS · PostgreSQL (Supabase) · Prisma · Docker  

---

## 1. Diagrama de Arquitectura de Capas

```text
┌────────────────────────────────────────────────────────────────────────┐
│                      INTERFACE & API LAYER (REST)                      │
│   - LedgerController (/ledger/transactions, /ledger/accounts, ...)    │
│   - FinancialReportsController (/financial-reports/*)                 │
│   - StudentAnalyticsController (/students/me/dashboard, ...)          │
│   - Commercial Controllers (/commercial/sales, /purchases, ...)       │
├────────────────────────────────────────────────────────────────────────┤
│                       GUARDS, PIPES & FILTERS                          │
│   - JwtAuthGuard + RolesGuard (AUTHORITY vs STUDENT vs TEACHER)       │
│   - OrgPermissionsGuard (inventory, sales, purchases, reports, ...)    │
│   - IdempotencyInterceptor (Header: Idempotency-Key)                  │
│   - ValidationPipe with @IsMoney() decorator                          │
│   - AllExceptionsFilter & Structured JSON Logging                     │
├────────────────────────────────────────────────────────────────────────┤
│                       APPLICATION SERVICES & USE CASES                 │
│   - LedgerService (Posting orchestration, atomic transactions)         │
│   - FinancialAccountsService (Balance aggregation, statement engine)   │
│   - FinancialReportsService (Trial balance, Income Statement, BS)      │
│   - StudentAnalyticsService (Student personal summary & history)      │
├────────────────────────────────────────────────────────────────────────┤
│                       ACCOUNTING & POSTING RULES DOMAIN                │
│   - StandardAccountCodes & getPymeStandardAccounts factory             │
│   - Posting rules: Sale, Purchase, Expense, Rental, Visit, WAC COGS    │
│   - Double-entry mathematical validator (SUM(Dr) == SUM(Cr))           │
│   - Reversal matrix generator (1-to-1 inverted entry set)              │
│   - Money domain utilities (MoneyUtil, NUMERIC(12,2) exact arithmetic) │
├────────────────────────────────────────────────────────────────────────┤
│                       DATA ACCESS & CONCURRENCY LAYER                  │
│   - PrismaService (with @prisma/adapter-pg driver adapter)             │
│   - runInTx (Atomic $transaction boundary reuse)                       │
│   - lockStudentAccount (SELECT ... FOR UPDATE)                         │
│   - pg_advisory_xact_lock (Transactional DB advisory lock)             │
│   - Repository queries with index-optimized scans                      │
├────────────────────────────────────────────────────────────────────────┤
│                       PERSISTENCE LAYER (PostgreSQL)                   │
│   - Tables: Transaction, LedgerEntry, LedgerAccount, StudentAccount    │
│   - Database Triggers: prevent_ledger_mutation() (Append-Only)         │
│   - Row Level Security (RLS) policies                                  │
│   - Indexes on (studentAccountId, createdAt), (ledgerAccountId, ...)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Flujo Transaccional de Posting (End-to-End)

```text
1. Client Request (POS / Deposit / Rental / Expense)
   │ Include Header: Idempotency-Key
   ▼
2. NestJS Gateway
   │ Check Idempotency Cache (Return cached response if already completed)
   │ Validate JWT & Organization Permissions
   ▼
3. Commercial / Wallet Domain Service
   │ Begin Prisma Transaction ($transaction)
   │ Acquire Row Locks:
   │   - StudentAccount FOR UPDATE (if wallet affected)
   │   - Inventory FOR UPDATE (if stock/WAC affected)
   ▼
4. Ledger Posting Engine
   │ Acquire Advisory Lock: pg_advisory_xact_lock(ldg:<key>)
   │ Check DB transaction table for existing idempotencyKey
   │ Validate Double-Entry: SUM(Debit) == SUM(Credit), Amount > 0
   │ Insert Transaction Record
   │ Insert LedgerEntry Records (Append-Only)
   ▼
5. Upstream Business Record Mutation
   │ Insert Sale / Purchase / Rental / Visit / Expense record
   │ Update Inventory stock / WAC if applicable
   ▼
6. Audit Log Generation
   │ Insert AuditLog entry (actorId, orgId, entity, action, requestId)
   ▼
7. Commit Database Transaction
   │ Advisory locks and row locks automatically released
   │ Database triggers guarantee immutability
   ▼
8. Response to Client (JSON with exact string-formatted money)
```

---

## 3. Manejo de Concurrencia y Aislamiento

| Riesgo de Concurrencia | Escenario | Mecanismo de Defensa |
| :--- | :--- | :--- |
| **Double Spend (Billetera)** | 2 débitos concurrentes sobre la misma billetera estudiantil con saldo insuficiente para ambos. | `SELECT id FROM "StudentAccount" WHERE id = $1 FOR UPDATE` dentro de `$transaction`. |
| **WAC Drift (Inventario)** | 2 compras o ventas simultáneas del mismo producto alterando el costo ponderado. | `SELECT ... FROM "Inventory" WHERE id = $1 FOR UPDATE` serializa el cálculo. |
| **Double Posting (Idempotencia)** | Reintentos simultáneos de red con la misma cabecera `Idempotency-Key`. | `pg_advisory_xact_lock(hashtext('ldg:' || key))` serializa la inserción en BD. |
| **Inconsistencia Parcial** | Falla en la inserción de un asiento o del registro comercial. | Única frontera `$transaction` (`runInTx`) ejecuta `ROLLBACK` total. |
| **Mutación Ilegítima** | Intento de `UPDATE` o `DELETE` sobre registros financieros existentes. | Trigger en PostgreSQL `prevent_ledger_mutation()` cancela la operación inmediatamente. |
