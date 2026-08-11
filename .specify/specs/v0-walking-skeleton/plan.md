# Technical Plan — Surcos 360 V0

## 1. Arquitectura del Sistema
Surcos 360 V0 se implementa como un monolito modular en NestJS (backend) acoplado con Next.js App Router (frontend) y Supabase PostgreSQL (persistencia + auth + RLS).

```text
┌────────────────────────────────────────────────────────┐
│                   Next.js App Router                   │
│     (Client Components / Server Components / UI)       │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP REST / Auth JWT
                           ▼
┌────────────────────────────────────────────────────────┐
│                   NestJS Modular API                   │
│ ┌──────────────┐ ┌─────────────┐ ┌───────────────────┐ │
│ │ Auth/Identity│ │Saving/Ledger│ │AgroRed/Inventory  │ │
│ └──────┬───────┘ └──────┬──────┘ └─────────┬─────────┘ │
│        │                │                  │           │
│        └────────────────┼──────────────────┘           │
│                         ▼                              │
│                    Prisma ORM                          │
└──────────────────────────┬─────────────────────────────┘
                           │ SET LOCAL claims + SQL
                           ▼
┌────────────────────────────────────────────────────────┐
│             Supabase (PostgreSQL 15+)                  │
│       - Supabase Auth (Users & JWT)                    │
│       - RLS Policies (Tabla por Tabla)                 │
│       - Double-Entry Ledger & Inventory Tables         │
└────────────────────────────────────────────────────────┘
```

---

## 2. Plan por Capas

### 2.1 Base de Datos y Modelo Prisma (`schema.prisma`)
Se definirán las siguientes entidades clave para V0:

- **Identidad:** `InstitutionalPerson`, `StudentRecord`, `Membership`, `Organization`, `RegistrationToken`.
- **Finanzas & Ledger:** `StudentAccount`, `LedgerAccount` (cuentas contables de PYME/Caja/Ingreso), `Transaction`, `LedgerEntry`, `IdempotencyKey`.
- **Agrored & Inventario:** `Supplier`, `Product`, `Inventory`, `InventoryItem`, `InventoryMovement`, `Purchase`, `PurchaseItem`, `Sale`, `SaleItem`.
- **Auditoría:** `AuditLog`.

#### Estrategia RLS con Prisma:
NestJS utilizará un middleware/interceptor Prisma que ante cada request autenticado ejecute dentro de una transacción interactiva:
```sql
SET LOCAL request.jwt.claims = '{"sub": "user-uuid", "role": "authenticated", ...}';
```
Garantizando que las políticas `CREATE POLICY ... USING (auth.uid() = ...)` de Postgres se apliquen estrictamente.

---

### 2.2 Backend (NestJS)

#### Módulos V0:
1. `IdentityModule`: Gestión de `InstitutionalPerson`, `StudentRecord`, importación de CSV (match exacto) y canje de `RegistrationToken`.
2. `AuthModule`: Integración con Supabase Auth SDK, verificación de Bearer JWT, extracción de claims y `UserContext`.
3. `LedgerModule`: Motor contable append-only. Método `createTransaction(entries: LedgerEntryDto[])` que valida $\sum \text{DEBIT} = \sum \text{CREDIT}$ dentro de un `$transaction` Prisma.
4. `AgroRedModule`: Productos, Inventario con locking (`$queryRaw` `SELECT ... FOR UPDATE`), WAC, registro de Compras y registro de Ventas (con deducción de saldo en `StudentAccount` e `Inventory`).
5. `AuditModule`: Interceptor global de eventos sensibles para crear registros en `AuditLog`.

#### Idempotencia:
Interceptor NestJS `@UseInterceptors(IdempotencyInterceptor)` para endpoints POST/PUT de mutación contable o de stock.

---

### 2.3 Frontend Design & Motion System (Next.js)

#### Arquitectura de Interfaz & Componentes:
- **Estructura de rutas V0:**
  - `/auth/login`, `/auth/register` (canje de token)
  - `/dashboard` (Redirección según rol)
  - `/student/dashboard` (Saldo, movimientos, actividad)
  - `/agrored/products`, `/agrored/inventory`, `/agrored/purchases`, `/agrored/sales`
  - `/admin/students/import`, `/admin/tokens`
- **Design Tokens:** Modos claro/oscuro, paleta institucional pulida, tipografía Inter/Outfit, espaciado modular.
- **Motion System (Skills Emil Kowalski):**
  - Transiciones de página sutiles (fade/slide 150-200ms ease-out).
  - Microinteracciones en botones de submit y estados de carga (spinners/skeletons).
  - Feedback de éxito/error contextual (sin abusar de toasts).
  - Respeto estricto a `@media (prefers-reduced-motion: reduce)`.

---

## 3. Estrategia de Pruebas (Testing Gate)

1. **Unit Tests:**
   - Ecuación de Partida Doble en `LedgerService` (rechazar asientos desbalanceados).
   - Algoritmo WAC en `InventoryService` con diferentes lotes y precios.
2. **Integration & Concurrency Tests:**
   - Simulación de compras/ventas concurrentes en AgroRed verificando advisory locks / `FOR UPDATE` en Postgres.
   - Verificación de Idempotencia enviando la misma `Idempotency-Key` N veces.
3. **Authorization & RLS Tests:**
   - Test con cliente Postgres autenticado como `STUDENT` intentando ejecutar insert directo en `Sale` o `InventoryMovement` (debe ser bloqueado por RLS).
