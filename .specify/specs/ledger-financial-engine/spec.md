# Functional & Technical Specification (spec.md)
## Surcos 360 — General Ledger & Central Financial Engine

**Documento:** `.specify/specs/ledger-financial-engine/spec.md`  
**Versión:** 2.0 (Production-Ready SDD)  
**Fuente Primaria:** `surcos-360-prd-v1.md` (§1, §2, §3, §4, §5, §6, §7, §8, §9, §11, §12, §13, §14)  
**Estado:** Especificación Aprobada para Implementación  

---

## 1. Resumen Ejecutivo del Análisis del PRD aplicado al Ledger

El PRD de **Surcos 360** establece que el sistema financiero debe operar bajo una arquitectura de **Libro Mayor de Partida Doble (Double-Entry General Ledger)** inmutable, auditable y determinista, custodiado institucionalmente en la organización **Surcos Saving** y consumido por las tres PYMES escolares activas (**AgroRed**, **Surcos Fit**, **Surcasino**) y las cuentas de ahorro de los estudiantes (**StudentAccount**).

### Principio Rector Financiero
> **"Saldos Derivados, No Saldos Almacenados":** Ninguna tabla o entidad de la base de datos almacena saldos mutables como fuente de verdad. Todo saldo, balance, estado financiero o constancia es una proyección matemática determinista obtenida a partir de la agregación de asientos contables (`LedgerEntry`) inmutables pertenecientes a transacciones balanceadas (`Transaction`).

$$\sum \text{Débitos} = \sum \text{Créditos} \quad \forall \; T \in \text{Transactions}$$

$$\text{Saldo}(\text{Cuenta}) = \sum \text{Débitos}(\text{Cuenta}) - \sum \text{Créditos}(\text{Cuenta}) \quad (\text{para Activos / Egresos / Billeteras})$$

$$\text{Saldo}(\text{Cuenta}) = \sum \text{Créditos}(\text{Cuenta}) - \sum \text{Débitos}(\text{Cuenta}) \quad (\text{para Pasivos / Patrimonio / Ingresos})$$

---

## 2. Frontera Arquitectónica Estricta: Ledger Core vs. Dominios Externos

Para evitar acoplamiento perjudicial y contaminación del dominio contable, se traza una línea divisoria innegociable:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 DOMINIOS EXTERNOS (UPSTREAM)                           │
│  - Identity & Auth (Users, InstitutionalPerson, Invitations, Passwords)                │
│  - Governance & Memberships (Roles, Permissions, Org Invitations)                      │
│  - Commercial & Inventory (Catalog, Products, SKU, Physical Movements, Batches)        │
│  - Sales UI / POS (Cart, Cashier, Physical Receipt, Rental Timer, Gym Access)          │
│  - Purchasing UI (Supplier orders, physical dispatch reception)                        │
│  - AI / RAG Assistants (Natural language prompts, tool routing, embeddings)            │
└─────────────────────────────────────────┬──────────────────────────────────────────────┘
                                          │ Emite Hecho Económico (Financial Event / DTO)
                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              POSTING & ACCOUNTING RULES ENGINE                         │
│  - Valida contexto de negocio y resuelve cuentas contables por organización/tipo       │
│  - Genera asientos de débito y crédito con montos exactos y referencias                │
└─────────────────────────────────────────┬──────────────────────────────────────────────┘
                                          │ Ejecuta dentro de $transaction atómica
                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   LEDGER CORE DOMAIN                                   │
│  - LedgerAccount & StudentAccount (identificadores y catalogación contable)            │
│  - Transaction & LedgerEntry (partida doble, append-only, inmutabilidad)              │
│  - Invariante ∑Debits = ∑Credits & Verificación de montos > 0                           │
│  - Idempotencia por DB Advisory Locks (`pg_advisory_xact_lock`)                       │
│  - Bloqueo pesimista de billeteras y cuentas (`SELECT ... FOR UPDATE`)                 │
│  - Motor de Reversiones (`reversalOfId`) y Ajustes Contables                           │
│  - Motor de Derivación de Saldos y Reconciliación                                      │
│  - Triggers Append-Only a nivel de PostgreSQL                                          │
│  - Auditoría Financiera sincrónica (`AuditLog`)                                        │
└─────────────────────────────────────────┬──────────────────────────────────────────────┘
                                          │ Proyecta datos para
                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               REPORTING & READ PROJECTIONS                             │
│  - Trial Balance (Balance de Comprobación)                                             │
│  - Income Statement (Estado de Resultados por PYME / Consolidado)                      │
│  - Balance Sheet (Balance General Patrimonial)                                         │
│  - Institutional Liquidity & Student Statement (Cartola de Ahorro Estudiantil)         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Bounded Context Map

| Bounded Context | Clasificación | Relación con Ledger | Responsabilidad Principal |
| :--- | :--- | :--- | :--- |
| **Ledger Core** | **Core Domain** | Centro de Verdad | Garantizar partida doble, inmutabilidad, saldos derivados, idempotencia y auditoría. |
| **Accounting Rules / Posting** | **Core Domain** | Transformador | Convertir hechos de negocio en asientos contables balanceados según el Plan de Cuentas. |
| **Commercial (Sales / POS)** | **Supporting Domain** | Upstream Caller | Gestionar ciclo de venta; invoca posting de ingreso y débito a cliente o billetera. |
| **Inventory & WAC** | **Supporting Domain** | Upstream Caller | Administrar stock físico y calcular Costo Promedio Ponderado (WAC); invoca posting de COGS. |
| **Purchasing & Payables** | **Supporting Domain** | Upstream Caller | Gestionar órdenes y facturas a proveedores; invoca posting de compras y pasivos. |
| **Student Savings** | **Supporting Domain** | Upstream Caller | Administrar depósitos, retiros y visualización de cartola estudiantil en Surcos Saving. |
| **Surcos Fit (Gym)** | **Generic / Subdomain** | Upstream Caller | Control de visitas (`FREE`/`PAID`); invoca posting de ingresos por accesos pagados. |
| **Surcasino (Rentals)** | **Generic / Subdomain** | Upstream Caller | Control de alquiler de juegos por tiempo; invoca posting de ingresos por alquiler. |
| **Identity & Access** | **Generic Domain** | Upstream / Cross | Autenticación JWT, tokens criptográficos, resolución de `InstitutionalPerson` y roles. |
| **Financial Reporting & AI** | **Supporting Domain** | Downstream Consumer | Proyecciones analíticas de solo lectura sobre el Ledger y RAG gobernado bajo RLS. |

---

## 4. Agregados, Entidades y Value Objects

### 4.1 Agregados del Dominio Ledger
1. **`FinancialTransaction` (Aggregate Root):**
   * Encapsula la transacción contable, su metadata, tipo, número único, actor, organización, referencia y su colección de asientos (`entries`).
   * **Invariante interna:** Una instancia de `FinancialTransaction` no puede existir en estado persistido si `entries.length < 2` o si $\sum \text{Debit} \neq \sum \text{Credit}$.
2. **`StudentAccount` (Entity / Sub-Aggregate):**
   * Representa la cuenta financiera de ahorro del estudiante bajo custodia de Surcos Saving.
   * Identificada por `id`, `accountNumber` (único) e `institutionalPersonId`.
   * El saldo se deriva de sus `LedgerEntry` asociados; no posee columna `balance`.
3. **`LedgerAccount` (Entity):**
   * Representa una cuenta contable del Plan de Cuentas de una Organización.
   * Tupla única: `(organizationId, code)`.
   * Tipos: `ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`.

### 4.2 Value Objects
* **`Money`:** Representación monetaria exacta de 2 decimales (`NUMERIC(12,2)` / `Prisma.Decimal` / `string` a nivel de API). Inmutable, operaciones sin pérdida de precisión, validación por regex estricto `^\d+(\.\d{1,2})?$`.
* **`EntryDirection`:** Enum `DEBIT` | `CREDIT`.
* **`TransactionType`:** Enum exhaustivo de 16 tipos contables según PRD.
* **`IdempotencyKey`:** Clave alfanumérica única con contexto de actor y operación.

---

## 5. Chart of Accounts (Plan de Cuentas Estándar)

El sistema implementa un Plan de Cuentas estandarizado y determinista por Organización, estructurado jerárquicamente:

### 5.1 Cuentas Centrales de Surcos Saving
* **`SAVING_CENTRAL_VAULT`** (`ASSET`): Bóveda / Caja central de custodia de fondos estudiantiles y tesorería escolar.
* **`STUDENT_SAVINGS_LIABILITY`** (`LIABILITY`): Cuenta de control pasivo que refleja la obligación global de ahorro de la institución con los estudiantes.

### 5.2 Cuentas Estándar por PYME (`<ORG_CODE>_*`)
Para cada PYME (ej. `AGRORED`, `FIT`, `SURCASINO`, o nuevas PYMES creadas dinámicamente):

| Código Estándar | Nombre de Cuenta | Tipo Contable | Naturaleza | Propósito / Hecho Económico |
| :--- | :--- | :--- | :--- | :--- |
| `<CODE>_CASH_VAULT` | Caja y Efectivo | `ASSET` | Débito | Fondos en efectivo o banco disponibles para la PYME. |
| `<CODE>_INVENTORY_ASSET` | Inventario Circulante | `ASSET` | Débito | Valoración monetaria del stock comercializable (WAC). |
| `<CODE>_FIXED_ASSETS` | Activos Fijos Patrimoniales | `ASSET` | Débito | Bienes duraderos, equipos, juegos y máquinas. |
| `<CODE>_ACCOUNTS_PAYABLE` | Cuentas por Pagar | `LIABILITY` | Crédito | Deudas y obligaciones con proveedores comerciales. |
| `<CODE>_REVENUE` | Ingresos Operativos | `REVENUE` | Crédito | Ventas de inventario, consumos, pases de gimnasio, alquileres. |
| `<CODE>_ASSET_SALE_REVENUE` | Ingresos Venta Activos | `REVENUE` | Crédito | Ingresos extraordinarios por venta de activos amortizados. |
| `<CODE>_COGS` | Costo de Ventas (COGS) | `EXPENSE` | Débito | Costo promedio ponderado de la mercadería vendida. |
| `<CODE>_OPERATING_EXPENSE` | Gastos Operativos | `EXPENSE` | Débito | Gastos de funcionamiento, servicios y suministros. |

---

## 6. Matriz Completa de Eventos Financieros → Asientos Contables

| Evento de Negocio | Tipo Transacción | Débito (Dr) | Crédito (Cr) | Módulo Origen | Regla Contable e Impacto |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Depósito en Billetera** | `DEPOSIT` | `SAVING_CENTRAL_VAULT` ($) | `StudentAccount` (Billetera) ($) | Surcos Saving | Incrementa efectivo en bóveda y aumenta el saldo pasivo del estudiante. |
| **Retiro de Billetera** | `WITHDRAWAL` | `StudentAccount` (Billetera) ($) | `SAVING_CENTRAL_VAULT` ($) | Surcos Saving | Disminuye saldo del estudiante y reduce efectivo en bóveda. |
| **Venta POS con Billetera** | `SALE` | `StudentAccount` (Billetera) ($) | `<PYME>_REVENUE` ($) | Sales / POS | Disminuye saldo estudiantil y acredita ingreso operativo a la PYME. |
| **Reconocimiento COGS Venta** | `COGS` | `<PYME>_COGS` (WAC × Q) | `<PYME>_INVENTORY_ASSET` (WAC × Q) | Inventory / Sales | Reconoce costo de ventas y disminuye el valor contable del inventario. |
| **Venta POS con Efectivo** | `SALE` | `<PYME>_CASH_VAULT` ($) | `<PYME>_REVENUE` ($) | Sales / POS | Entra dinero a la caja de la PYME y reconoce ingreso operativo. |
| **Compra Inventario Contado** | `PURCHASE` | `<PYME>_INVENTORY_ASSET` ($) | `<PYME>_CASH_VAULT` ($) | Purchasing | Incrementa valor de inventario y disminuye caja de la PYME. |
| **Compra Inventario a Crédito** | `PURCHASE` | `<PYME>_INVENTORY_ASSET` ($) | `<PYME>_ACCOUNTS_PAYABLE` ($) | Purchasing | Incrementa valor de inventario y registra deuda con proveedor. |
| **Pago a Proveedor (Pasivo)** | `LIABILITY_PAYMENT` | `<PYME>_ACCOUNTS_PAYABLE` ($) | `<PYME>_CASH_VAULT` ($) | Liabilities / Pay | Amortiza deuda y disminuye caja de la PYME. |
| **Registro de Gasto Operativo** | `EXPENSE` | `<PYME>_OPERATING_EXPENSE` ($) | `<PYME>_CASH_VAULT` ($) | Expenses | Reconoce egreso operativo y disminuye caja de la PYME. |
| **Adquisición de Activo Fijo** | `ASSET_PURCHASE` | `<PYME>_FIXED_ASSETS` ($) | `<PYME>_CASH_VAULT` o `_PAYABLE` ($) | Assets / Purchase | Capitaliza bien patrimonial y afecta caja o genera pasivo. |
| **Venta de Activo Fijo** | `ASSET_SALE` | `<PYME>_CASH_VAULT` o Billetera ($) | `<PYME>_ASSET_SALE_REVENUE` ($) | Assets / Sales | Registra cobro y acredita ingreso extraordinario. |
| **Visita Gimnasio Pagada** | `VISIT_FEE` | `StudentAccount` o `_CASH_VAULT` ($) | `FIT_REVENUE` ($) | Surcos Fit | Disminuye billetera/caja y acredita ingreso a Surcos Fit. |
| **Alquiler de Juego Liquidado** | `RENTAL_FEE` | `StudentAccount` o `_CASH_VAULT` ($) | `SURCASINO_REVENUE` ($) | Surcasino | Disminuye billetera/caja y acredita ingreso a Surcasino. |
| **Ajuste Stock por Merma** | `ADJUSTMENT` | `<PYME>_OPERATING_EXPENSE` ($) | `<PYME>_INVENTORY_ASSET` ($) | Inventory | Registra pérdida operativa y reduce valor contable de stock. |
| **Reversión de Transacción** | `REVERSAL` | Espejo inverso exacto de la TX original | Espejo inverso exacto de la TX original | Ledger Core | Restaura saldos exactos vinculando `reversalOfId`. |

---

## 7. Invariantes Financieras

1. **Invariante 1: Balance Matemático Absoluto:**
   $$\sum_{e \in \text{entries}} e.\text{amount} [\text{direction} = \text{DEBIT}] = \sum_{e \in \text{entries}} e.\text{amount} [\text{direction} = \text{CREDIT}]$$
2. **Invariante 2: Cardinalidad Mínima:** Toda transacción debe contener al menos 2 asientos (`entries.length >= 2`).
3. **Invariante 3: Positividad Estricta:** Todo monto contable debe ser estrictamente positivo ($amount > 0$).
4. **Invariante 4: Inmutabilidad Append-Only:** Una fila en `Transaction` o `LedgerEntry` jamás puede ser actualizada (`UPDATE`) o eliminada (`DELETE`). Forzado mediante triggers de PostgreSQL:
   ```sql
   CREATE OR REPLACE FUNCTION prevent_ledger_mutation() RETURNS trigger AS $$
   BEGIN
       RAISE EXCEPTION 'Financial Ledger is append-only. UPDATE/DELETE forbidden on %', TG_TABLE_NAME;
   END;
   $$ LANGUAGE plpgsql;
   ```
5. **Invariante 5: Solvencia en Billeteras:** El saldo derivado de una `StudentAccount` jamás puede ser negativo tras un débito.
6. **Invariante 6: Unicidad de Reversión:** Una transacción posteada solo puede ser revertida exactamente una vez. No se permite revertir una reversión.
7. **Invariante 7: Idempotencia Libre de Duplicados:** Si se invoca una operación financiera con un `idempotencyKey` ya procesado, se retorna el resultado persistido original sin mutar el ledger.
8. **Invariante 8: Contexto de Tenancy Válido:** Todo asiento contable debe pertenecer a una cuenta institucional o de una organización existente y activa.

---

## 8. Estrategia de Concurrencia y Bloqueos

Para evitar condiciones de carrera tipo **Time-of-Check to Time-of-Use (TOCTOU)** y doble gasto:

1. **Bloqueo Pesimista de Billetera (`StudentAccount`):**
   ```sql
   SELECT id FROM "StudentAccount" WHERE id = $1 FOR UPDATE;
   ```
   Se ejecuta como primer paso dentro de la transacción Prisma `$transaction` antes de consultar el saldo derivado y aplicar el débito.
2. **Bloqueo Pesimista de Inventario y WAC (`Inventory` / `Product`):**
   ```sql
   SELECT id, stock, "weightedAverageCost" FROM "Inventory" WHERE id = $1 FOR UPDATE;
   ```
   Serializa el recálculo determinista de WAC y el descuento de existencias.
3. **Bloqueo de Asesoría Transaccional para Idempotencia:**
   ```sql
   SELECT pg_advisory_xact_lock(hashtext('ldg:' || $idempotencyKey));
   ```
   Garantiza que dos solicitudes concurrentes con la misma llave se serialicen a nivel de PostgreSQL, permitiendo a la segunda detectar la transacción existente y retornar sin error de colisión ni duplicación.
4. **Límite Transaccional Único (`runInTx`):** Todas las operaciones dentro de un flujo de negocio (comercio + inventario + ledger + auditoría) comparten exactamente el mismo objeto transaccional `Prisma.TransactionClient`. Si cualquier paso falla, se ejecuta `ROLLBACK` atómico total.

---

## 9. Estrategia de Testing y Verificación

1. **Unit Tests (Jest):**
   * Validación de partida doble, rechazo de asientos desbalanceados, montos negativos o nulos.
   * Derivación de saldos por lotes (`getStudentAccountBalances`, `getLedgerAccountBalances`).
   * Precisión de `MoneyUtil` y parsing monetario.
2. **Integration Tests (PostgreSQL Real en Docker):**
   * Verificación de triggers append-only ante intentos de `UPDATE` o `DELETE`.
   * Simulación de doble gasto concurrente (2 retiros simultáneos de $20 con saldo de $20 $\rightarrow$ exactamente 1 exitoso, saldo final $0.00).
   * Verificación de idempotencia concurrente con advisory locks.
   * Reversiones y restauración de saldos.
3. **E2E Tests (NestJS Testing):**
   * Aislamiento multi-tenant por institución y membresías de organización.
   * Protección RBAC en endpoints de analítica y ledger.
   * Flujo comercial completo: Venta $\rightarrow$ Débito Billetera $\rightarrow$ Ingreso PYME $\rightarrow$ COGS $\rightarrow$ Auditoría.