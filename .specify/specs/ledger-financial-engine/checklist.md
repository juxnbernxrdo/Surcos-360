# Checklist — Ledger & Central Financial Engine

## Source of Truth
- [ ] PRD v1.0 reviewed completely (ledger, accounts, students, savings, purchases, sales, inventory, assets, liabilities, PYMES, reports, audit, permissions, multi-tenancy).
- [ ] No feature contradicting the PRD; non-specified decisions documented as architecture decisions.

## Architecture
- [ ] Single central financial engine (no per-domain ledgers/balances).
- [ ] Business Event separated from Ledger Transaction.
- [ ] Balance is derived, never stored/modified directly (`PATCH /student/:id/balance` absent).

## Double-Entry & Precision
- [ ] SUM(DEBIT) == SUM(CREDIT) enforced server-side on every transaction.
- [ ] No unbalanced, zero, or negative entries accepted.
- [ ] Money is NUMERIC(12,2)/Decimal; no JS float at boundary; string serialization.

## Students
- [ ] Student reads own balance/movements/activity/statistics/reports.
- [ ] Student cannot create/modify ledger, sales, purchases, inventory, products, suppliers.

## Commercial & Inventory
- [ ] Sales/Purchases post to ledger inside one ACID transaction.
- [ ] Inventory mutation and financial consequence coordinated (not conflated).
- [ ] WAC with row-locking; assets/liabilities/expenses separated.

## Integrity
- [ ] Append-only (DB triggers block UPDATE/DELETE).
- [ ] Reversals create new transactions with `reversalOfId`; original preserved.
- [ ] Idempotency keys at HTTP and DB level.
- [ ] Concurrency: student-wallet row lock + inventory row lock prevent double-spend.
- [ ] Multi-tenancy + authorization on every ledger route.

## Database
- [ ] Foreign keys, indexes, unique constraints, decimal precision, ownership, no cascade-delete on financial history.
- [ ] RLS script references real tables; documented activation.

## Testing
- [ ] Unit tests (debit/credit rules, balance, validation, reversal, idempotency, authorization, money precision).
- [ ] Invariant/property tests (double-entry + deterministic balance).
- [ ] Integration tests (Postgres, transactions, constraints, concurrency, rollback).
- [ ] E2E (student deposit→balance, purchase→ledger→balance, sale→inventory+ledger, authority view).
- [ ] Security (duplicate, concurrent, invalid, unauthorized, cross-tenant, unauthorized reversal).

## Hygiene
- [ ] No dead code, no duplicate financial engines, no legacy ledger remnants.
- [ ] Documentation reflects implemented architecture (Mermaid diagrams).