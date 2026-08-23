# Financial Invariants & Integrity Controls (ledger-invariants.md)
## Surcos 360 — General Ledger & Financial Engine

**Documento:** `.specify/specs/ledger-financial-engine/ledger-invariants.md`  
**Versión:** 2.0  

---

## 1. Matriz de Invariantes Matemáticas y de Dominio

| ID | Nombre de Invariante | Formulación / Regla | Mecanismo de Garantía | Severidad de Violación |
| :--- | :--- | :--- | :--- | :--- |
| **INV-01** | **Balance de Partida Doble** | $\sum \text{Debits} = \sum \text{Credits}$ por cada `Transaction`. | Validación en `LedgerService.createTransaction` antes de insertar. | **CRÍTICO (Rollback)** |
| **INV-02** | **Multi-asiento Mínimo** | `entries.length >= 2` por cada `Transaction`. | Validación previa a persistencia. | **CRÍTICO (Rollback)** |
| **INV-03** | **Positividad Monetaria** | $\text{entry.amount} > 0 \quad \forall \; \text{entry}$. | Validación `MoneyUtil.parse` + Check en base de datos. | **CRÍTICO (Rollback)** |
| **INV-04** | **Inmutabilidad Absoluta** | Prohibido `UPDATE` y `DELETE` en `Transaction` y `LedgerEntry`. | Trigger PostgreSQL `prevent_ledger_mutation()`. | **CRÍTICO (Excepción DB)** |
| **INV-05** | **No Saldo Negativo en Billeteras** | $\text{Saldo}(StudentAccount) \ge 0$. | `SELECT ... FOR UPDATE` + Verificación atómica de saldo previo al débito. | **ALTO (Rechazo 400)** |
| **INV-06** | **Unicidad de Reversión** | Solo 1 reversión por transacción. No se revierten transacciones revertidas ni reversiones. | Constraint y verificación en `LedgerService.reverseTransaction`. | **ALTO (Rechazo 409/400)** |
| **INV-07** | **Idempotencia Estricta** | Misma llave + mismo actor = mismo resultado sin duplicación. | `pg_advisory_xact_lock` + Unique index `idempotencyKey`. | **ALTO (Replay seguro)** |
| **INV-08** | **Determinismo de WAC** | $WAC_{nuevo} = \frac{(S \times W) + (Q \times C)}{S + Q}$. | Bloqueo pesimista en `Inventory` + cálculo exacto. | **ALTO (Integridad de Costos)** |

---

## 2. Definición del Trigger PostgreSQL de Inmutabilidad

```sql
CREATE OR REPLACE FUNCTION prevent_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Financial Ledger is append-only. UPDATE/DELETE operations are strictly forbidden on table %', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_transaction_mutation ON "Transaction";
CREATE TRIGGER trg_prevent_transaction_mutation
BEFORE UPDATE OR DELETE ON "Transaction"
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();

DROP TRIGGER IF EXISTS trg_prevent_ledger_entry_mutation ON "LedgerEntry";
CREATE TRIGGER trg_prevent_ledger_entry_mutation
BEFORE UPDATE OR DELETE ON "LedgerEntry"
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();
```
