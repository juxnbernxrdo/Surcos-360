# Quality Checklists — Surcos 360 V0

## 1. Safety & Security Checklist
- [ ] **Supabase Auth JWT:** Todos los endpoints NestJS (excepto auth públicos) requieren Bearer JWT válido.
- [ ] **Tres Capas de Autorización:**
  - [ ] UI oculta acciones de escritura para `STUDENT`.
  - [ ] NestJS Guard retorna 403 Forbidden para `STUDENT` en endpoints de PYME/Ledger.
  - [ ] Postgres RLS deniega `INSERT`/`UPDATE`/`DELETE` en tablas sensibles para el rol `STUDENT`.
- [ ] **Secrets & Service Role:** La `service_role` key de Supabase **nunca** se incluye en variables de entorno públicas del frontend (`NEXT_PUBLIC_*`).
- [ ] **Idempotencia:** Endpoints mutables de dinero/inventario requieren header `Idempotency-Key` y bloquean reejecuciones.
- [ ] **Rate Limiting:** NestJS Throttler activo en endpoints de autenticación y canje de tokens.

---

## 2. Finance & Ledger Checklist
- [ ] **Partida Doble Strict:** Cada `Transaction` valida $\sum \text{DEBIT} = \sum \text{CREDIT}$.
- [ ] **Inmutabilidad:** No existen endpoints para modificar o eliminar `LedgerEntry` existentes. Los ajustes se realizan mediante reveses o nuevas transacciones.
- [ ] **No Float para Dinero:** Todos los campos de monto en Prisma son `Decimal` (mapped a `NUMERIC(12,2)`).
- [ ] **Saldos Derivados:** El saldo de `StudentAccount` se calcula agregando el ledger y no editando un campo suelto.

---

## 3. Inventory & WAC Checklist
- [ ] **WAC Correctness:** El costo promedio ponderado se recalcula con $(Q_{prev} \cdot C_{prev} + Q_{new} \cdot C_{new}) / (Q_{total})$.
- [ ] **Locking de Concurrencia:** La query de recálculo y actualización de stock utiliza `FOR UPDATE` dentro de una transacción interactiva.
- [ ] **Audit Trail:** Cada cambio de stock crea una fila inmutable en `InventoryMovement`.

---

## 4. Identity Checklist
- [ ] **Persona Única:** `InstitutionalPerson` no se duplica ante importaciones masivas.
- [ ] **Match Exacto V0:** Importador CSV enlaza por `institutionalCode` o `email` exacto.
- [ ] **Token Hashing:** `RegistrationToken` almacena el token hasheado en base de datos.

---

## 5. Frontend & UX (Emil Kowalski Standards) Checklist
- [ ] **Visual Hierarchy:** Uso claro de tipografía, pesos y contraste en Next.js.
- [ ] **Complete States:** Implementados estados de Loading (skeletons), Error (mensajes claros con reintento), Empty (pantallas vacías informativas) y Success.
- [ ] **Functional Motion:** Animaciones cortas (<200ms) orientadas al feedback visual.
- [ ] **Reduced Motion:** Todos los estilos CSS con animaciones incluyen `@media (prefers-reduced-motion: reduce)`.
- [ ] **Responsive & Accessibility:** Interfaz completamente operable con teclado, contraste AA y adaptativa a móvil/desktop.
