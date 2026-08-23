# Ledger & Motor Financiero Central — Surcos 360

**Estado:** Motor Financiero Oficial Enterprise (Única Fuente Confiable de Verdad)
**Fuente Funcional de Verdad:** `surcos-360-prd-v1.md` (§5, §7, §8, §9, §11, §13, §14, §18, §19, §28, §29)
**Clasificación:** Infraestructura Financiera Reutilizable, Inmutable y Multi-Tenant

---

## 1. Visión y Principio Rector

El **Ledger de Surcos 360** es el motor contable y financiero central de la plataforma. Ha sido diseñado como **infraestructura unificada y reutilizable** para todos los dominios del ecosistema:

* Estudiantes y representantes (Cuentas de Ahorro en Surcos Saving).
* Surcos Saving (Gobernanza central, liquidez y custodia de fondos).
* PYMES escolares (AgroRed, Surcos Fit, Surcasino y futuras organizaciones).
* Módulos comerciales (Ventas POS, Compras WAC, Inventario, Activos, Pasivos, Gastos).
* Reportes financieros, estadísticas y asistencia de Inteligencia Artificial (RAG).

> **Principio de Única Fuente de Verdad:** Ningún módulo mantiene saldos o balances mutables independientes. Todo saldo monetario se deriva de forma determinística sumando los asientos inmutables (*append-only ledger entries*) registrados en el libro mayor general.

```
       Eventos de Negocio (Sale, Purchase, Expense, Visit, Rental, Deposit, Withdraw)
                                   ↓
                   Transacciones Contables (Transaction)
                                   ↓
                   Asientos de Partida Doble (LedgerEntry)
                                   ↓
            Saldos Derivados / Balances / Estados Financieros / RAG
```

---

## 2. Invariante Matemática y Partida Doble

Toda transacción económica registrada satisface la ecuación de equilibrio de partida doble:

$$\sum \text{Débitos} = \sum \text{Créditos}$$

### Reglas Inquebrantables del Motor
1. **Validación Previa al Commit:** Si la suma de débitos no coincide con la suma de créditos, el motor rechaza la operación con `400 Bad Request` sin persistir ningún registro (verificado con prueba de integración).
2. **Precisión Numérica Exacta:** Todos los cálculos y persistencias monetarias utilizan `NUMERIC(12, 2)` (`Prisma.Decimal`). Prohibido el uso de coma flotante (`number` / `FLOAT`).
3. **Frontera de Dinero como String:** En el borde de la API y en todas las respuestas de servicio, el dinero se serializa como string (`"8.50"`) vía `MoneyUtil.toString` / `MoneyUtil.signed`. Solo `MoneyUtil.parse` acepta entrada; `MONEY_REGEX = /^\d+(\.\d{1,2})?$/`.
4. **Monto Estrictamente Positivo:** Cada asiento contable debe ser $> 0$.
5. **Mínimo de 2 Asientos:** Cada transacción contiene al menos dos asientos balanceados.
6. **Inmutabilidad Absoluta (*Append-Only*):** Las transacciones y asientos nunca se modifican (`UPDATE`) ni se eliminan (`DELETE`); triggers de BD (`0001_ledger_financial_engine`) lo impiden a nivel de base de datos (verificado por prueba de integración). Cualquier ajuste o anulación se realiza mediante una transacción de reversión (`REVERSAL`).

---

## 3. Garantías de Concurrencia, Atómica e Idempotencia

El motor ejecuta toda operación mutante dentro de una **única transacción de base de datos** (`$transaction` interactiva → `ROLLBACK` total ante cualquier fallo):

```mermaid
sequenceDiagram
    participant C as Cliente (POS / Admin)
    participant S as LedgerService
    participant DB as PostgreSQL

    C->>S: deposit / withdraw / createTransaction
    S->>DB: BEGIN ($transaction)
    S->>DB: pg_advisory_xact_lock(ldg:{idempotencyKey})  (si key presente)
    alt Transacción duplicada con misma key
        DB-->>S: devuelve transacción existente (idempotente)
    else Clave nueva
        S->>DB: SELECT ... FOR UPDATE (StudentAccount / Product / Inventory)
        S->>DB: verificar saldo / stock bajo bloqueo
        S->>DB: INSERT Transaction + 2+ LedgerEntry (double-entry balanceado)
        S->>DB: COMMIT
    end
    S-->>C: Transacción + asientos (dinero como string)
```

* **`runInTx`:** si se invoca con el servicio raíz abre `$transaction`; si se invoca desde una transacción padre reutiliza el `tx` (sin transacción anidada).
* **`lockStudentAccount` (`SELECT ... FOR UPDATE`):** serializa verificación de saldo + escritura y elimina el *double-spend* TOCTOU (verificado con dos retiros concurrentes por $20.00 → exactamente **uno** prospera).
* **Bloqueo de asesoría (`pg_advisory_xact_lock(hashtext('ldg:${key}'))`):** dos `createTransaction` concurrentes con la misma `idempotencyKey` producen una única fila (verificado por prueba de integración).
* **HTTP:** `IdempotencyInterceptor` global cachea respuestas para `idempotency-key`; el bloqueo de asesoría es la capa de defensa en profundidad a nivel DB.

---

## 4. Modelo de Datos Financiero

```mermaid
classDiagram
    class Organization {
        +UUID id
        +String code
        +String name
        +Boolean isPyme
    }

    class InstitutionalPerson {
        +UUID id
        +String institutionalCode
        +UserType userType
    }

    class StudentAccount {
        +UUID id
        +UUID institutionalPersonId
        +String accountNumber
        +DateTime createdAt
    }

    class LedgerAccount {
        +UUID id
        +UUID organizationId
        +String code
        +String name
        +AccountType type
    }

    class Transaction {
        +UUID id
        +String transactionNumber
        +TransactionType type
        +String description
        +String referenceType
        +String referenceId
        +UUID organizationId
        +UUID actorId
        +UUID reversalOfId
        +String idempotencyKey
        +String currency
        +Json metadata
        +DateTime createdAt
    }

    class LedgerEntry {
        +UUID id
        +UUID transactionId
        +UUID studentAccountId
        +UUID ledgerAccountId
        +EntryDirection direction
        +Decimal amount
        +DateTime createdAt
    }

    Organization "1" <-- "0..*" LedgerAccount : posee
    Organization "1" <-- "0..*" Transaction : pertenece
    InstitutionalPerson "1" <-- "1" StudentAccount : vincula
    StudentAccount "1" <-- "0..*" LedgerEntry : afecta
    LedgerAccount "1" <-- "0..*" LedgerEntry : afecta
    Transaction "1" *-- "2..*" LedgerEntry : compone
```

---

## 5. Plan de Cuentas Estándar (Chart of Accounts)

Cada organización/PYME cuenta con su catálogo contable estandarizado aprovisionado automáticamente (`ensureOrganizationAccounts`, idempotente):

| Cuenta | Tipo | Código | Naturaleza Normal | Descripción Funcional |
| :--- | :--- | :--- | :--- | :--- |
| **Bóveda Central** | `ASSET` | `SAVING_CENTRAL_VAULT` | Deudora (DEBIT) | Liquidez en custodia de Surcos Saving. |
| **Pasivo Ahorro Estudiantil** | `LIABILITY` | `STUDENT_SAVINGS_LIABILITY` | Acreedora (CREDIT) | Fondos custodiados a los estudiantes. |
| **Caja / Efectivo** | `ASSET` | `<ORG>_CASH_VAULT` | Deudora (DEBIT) | Efectivo disponible en la PYME. |
| **Inventario Circulante** | `ASSET` | `<ORG>_INVENTORY_ASSET` | Deudora (DEBIT) | Valoración de existencias a Costo WAC. |
| **Activos Fijos** | `ASSET` | `<ORG>_FIXED_ASSETS` | Deudora (DEBIT) | Equipos, mobiliario y bienes patrimoniales. |
| **Ingresos Operativos** | `REVENUE` | `<ORG>_REVENUE` | Acreedora (CREDIT) | Ventas de productos, servicios o accesos. |
| **Costo de Ventas (COGS)** | `EXPENSE` | `<ORG>_COGS` | Deudora (DEBIT) | Costo de adquisición de bienes vendidos. |
| **Gastos Operativos** | `EXPENSE` | `<ORG>_OPERATING_EXPENSE` | Deudora (DEBIT) | Gastos de suministros, mantenimiento, etc. |
| **Cuentas por Pagar** | `LIABILITY` | `<ORG>_ACCOUNTS_PAYABLE` | Acreedora (CREDIT) | Obligaciones y deudas con proveedores. |
| **Venta de Activos** | `REVENUE` | `<ORG>_ASSET_SALE_REVENUE` | Acreedora (CREDIT) | Ingresos extraordinarios por venta de bienes. |

---

## 6. Reglas de Derivación de Saldos

El saldo no se guarda en una columna mutable; se deriva determinísticamente bajo demanda:

* `getStudentAccountBalance` (una billetera), `getStudentAccountBalances` (batch, elimina N+1), `getStudentAccountBalanceAsOf` (balances iniciales de reportes).
* `getLedgerAccountBalances` (batch por cuentas contables organizacionales).

### 6.1 Cuenta de Estudiante (`StudentAccount`)
$$\text{Saldo Estudiante} = \sum \text{Créditos} - \sum \text{Débitos}$$
* **CREDIT (+):** Depósitos iniciales, aportes de ahorro, devoluciones/reembolsos.
* **DEBIT (-):** Compras en PYMES, visitas pagadas, alquileres, retiros autorizados.

### 6.2 Cuentas Contables Organizacionales (`LedgerAccount`)
* **Activos (`ASSET`) y Gastos (`EXPENSE` / `COGS`):** $\text{Saldo} = \sum \text{Débitos} - \sum \text{Créditos}$
* **Pasivos (`LIABILITY`), Ingresos (`REVENUE`) y Patrimonio (`EQUITY`):** $\text{Saldo} = \sum \text{Créditos} - \sum \text{Débitos}$

---

## 7. Flujos Económicos Integrados

### 7.1 Depósito Estudiantil (Surcos Saving)
```text
Transacción: DEPOSIT
├── DEBIT   SAVING_CENTRAL_VAULT (Asset)             +$50.00
└── CREDIT  StudentAccount (Juan Pérez - Liability)  +$50.00
```

### 7.2 Venta POS con Débito a Billetera Estudiantil (AgroRed)
```text
Transacción: PURCHASE / SALE
├── DEBIT   StudentAccount (Juan Pérez - Liability)  -$8.50
└── CREDIT  AGRORED_REVENUE (Revenue)                +$8.50

Transacción: COGS (Automática si hay inventario)
├── DEBIT   AGRORED_COGS (Expense)                   +$5.20
└── CREDIT  AGRORED_INVENTORY_ASSET (Asset)          -$5.20
```

### 7.3 Compra de Mercadería a Proveedor (AgroRed)
```text
Transacción: PURCHASE
├── DEBIT   AGRORED_INVENTORY_ASSET (Asset)          +$200.00
└── CREDIT  AGRORED_ACCOUNTS_PAYABLE (Liability)     +$200.00
```

### 7.4 Reversión Inmutable (Anulación de Venta)
```text
Transacción Original: TX-00984
Transacción Reversión: REV-10023 (reversalOfId: TX-00984)
├── CREDIT  StudentAccount (Juan Pérez)              +$8.50
└── DEBIT   AGRORED_REVENUE                          -$8.50
```
Una transacción solo puede revertirse una vez (detección previa → `409 Conflict`); una reversión nunca se revierte (→ `400`).

---

## 8. Reportes y Estados Financieros

El motor genera en tiempo real los cuatro reportes canónicos:

1. **Balance de Comprobación (`Trial Balance`):** Consolida todos los débitos y créditos del período verificando $\sum \text{Debits} = \sum \text{Credits}$.
2. **Estado de Resultados (`Income Statement / P&L`):**
   $$\text{Ingresos} - \text{COGS} = \text{Utilidad Bruta}$$
   $$\text{Utilidad Bruta} - \text{Gastos Operativos} = \text{Utilidad Neta}$$
3. **Balance General (`Balance Sheet`):**
   $$\text{Activos Totales} = \text{Pasivos Totales} + \text{Patrimonio} + \text{Utilidades Retenidas}$$
4. **Visión Institucional (`Institutional Governance Overview`):** Panel global para Autoridades con liquidez de Surcos Saving, custodia total de ahorro estudiantil y desglose de rendimiento por PYME.

---

## 9. Aislamiento Multi-Tenant (Tenant Context §29)

* **`AUTHORITY`** tiene alcance global (todas las organizaciones e instituciones).
* **`TEACHER` / usuarios de PYME** ven exclusivamente sus **membresías activas**:
  * `GET /ledger/transactions` y `GET /ledger/transactions/:id` se filtran a las organizaciones del actor (`organizationId IN memberships`); un `organizationId` ajeno → `403 Forbidden`, y un ID de transacción ajeno se trata como `404 Not Found`.
  * `GET /ledger/organizations/:orgId/accounts`, `POST .../accounts` y `GET /ledger/accounts/:id/statement` validan el `orgId`/cuenta contra las membresías del actor.
* El servicio de estudiantes aplica el mismo patrón por **institución** (`institutionId`); operar sobre un estudiante de otra institución → `404`.

---

## 10. Contrato de API y Control de Acceso

| Método | Endpoint | Rol Requerido | Alcance |
| :--- | :--- | :--- | :--- |
| `POST` | `/ledger/transactions` | `AUTHORITY` | Global |
| `POST` | `/ledger/reversals/:id` | `AUTHORITY` | Global |
| `POST` | `/ledger/students/:id/deposit` | `AUTHORITY` | Global |
| `POST` | `/ledger/students/:id/withdraw` | `AUTHORITY` | Global |
| `GET` | `/ledger/transactions` | `AUTHORITY`, `TEACHER` | Filtrado a membresías activas |
| `GET` | `/ledger/transactions/:id` | `AUTHORITY`, `TEACHER` | Solo transacciones de sus orgs |
| `GET` | `/ledger/organizations/:orgId/accounts` | `ADMIN`, `USER` | Solo su org |
| `GET` | `/ledger/accounts/:id/statement` | `ADMIN`, `USER` | Solo su org |
| `GET` | `/ledger/reports/trial-balance` | `AUTHORITY`, `TEACHER` | Filtrado a membresías activas |
| `GET` | `/ledger/reports/organizations/:orgId/income-statement` | `reports.read` | Solo su org |
| `GET` | `/ledger/reports/organizations/:orgId/balance-sheet` | `reports.read` | Solo su org |
| `GET` | `/ledger/reports/institutional-overview` | `AUTHORITY` | Global |
| `POST` | `/organizations/:orgId/commercial/sales/:id/cancel` | `sales.cancel` | Reversión contable automática |

---

## 11. Verificación y Pruebas

| Suites | Resultado |
| :--- | :--- |
| `npm run build` + `npm run lint` | Verdes |
| Unit (Jest) — 127 tests | Verdes |
| E2e (Jest, config `test/jest-e2e.json`) — 67 tests | Verdes |
| **Integración real PostgreSQL** (`test/ledger.integration.e2e-spec.ts`) | Verdes |

La suite de integración requiere una PostgreSQL real (Docker) con migraciones aplicadas:

```bash
docker run -d --name s360-ledger-test -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=s360_test -p 54329:5432 postgres:17
DATABASE_URL="postgresql://postgres:postgres@localhost:54329/s360_test" npx prisma migrate deploy
DATABASE_URL="postgresql://postgres:postgres@localhost:54329/s360_test" npm run test:e2e
```

Cubre: partida doble balanceada + derivación de saldo, rechazo de entrada desbalanceada (rollback), rechazo de retiro sin saldo, **doble gasto concurrente** (un solo retiro prospera), **idempotencia concurrente** por `idempotencyKey`, reversión que restaura saldo + rechazo de doble reversión, e **inmutabilidad** a nivel de BD.

**Nota de ejecución:** `PrismaService` usa el driver adapter `@prisma/adapter-pg` (Prisma 7 ya no auto-configura `DATABASE_URL` en el runtime). `DATABASE_URL` se lee de entorno.