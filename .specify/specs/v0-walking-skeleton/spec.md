# Specification — Surcos 360 V0 (Walking Skeleton)

## 1. Visión General del Incremento V0
El alcance V0 de Surcos 360 comprende un corte transversal delgado y completamente funcional (Walking Skeleton) que abarca:
1. Autenticación con Supabase Auth e incorporación de estudiantes mediante `RegistrationToken`.
2. Identidad Unificada e Institucional (`InstitutionalPerson`, `User`, `StudentRecord`).
3. Importación CSV/XLSX simplificada con coincidencia exacta por código o correo institucional.
4. Motor financiero basado en Ledger de Partida Doble append-only y cuentas estudiantiles (`StudentAccount`).
5. Operaciones financieras V0 (`INITIAL_BALANCE`, `DEPOSIT`, `WITHDRAWAL`, `PURCHASE`).
6. Una PYME completa: **AgroRed** (Productos, Inventario, Proveedores, Compras, Ventas, COGS con WAC y control de concurrencia).
7. Auditoría implícita (`AuditLog`), Idempotencia y Transacciones ACID.
8. Autorización de 3 capas (`STUDENT` restringido) y RLS en Postgres.
9. UI Responsive & Accesible en Next.js con skills de Emil Kowalski.

---

## 2. Personas y Actores
- **Student (Estudiante):** Consulta saldo, movimientos, productos y actividad propia. **Sin permisos de mutación comercial ni financiera.**
- **Teacher / Representative / Authority:** Usuarios de consulta o gestión institucional.
- **Organization Member (AgroRed Member):** Miembro autorizado (`OWNER`, `ADMIN`, `MANAGER`, `EMPLOYEE`) que registra compras, ventas y movimientos de inventario en AgroRed.
- **Global Administrator (Surcos Saving Admin):** Administra usuarios, realiza importaciones, emite tokens y supervisa transacciones.

---

## 3. Historias de Usuario (User Stories V0)

### Identity & Auth
- **US-01:** Como Administrador Global, quiero generar `RegistrationTokens` para estudiantes para que puedan completar su registro vinculándose a su `StudentRecord`.
- **US-02:** Como Estudiante, quiero registrarme utilizando un token institucional válido para asociar mi correo/cuenta a mi `InstitutionalPerson` existente.
- **US-03:** Como Administrador, quiero importar una lista de estudiantes desde un CSV/XLSX (match exacto) para crear registros institucionales y cuentas iniciales de forma masiva.

### Ledger & Cuentas Estudiantiles
- **US-04:** Como Sistema, debo registrar el saldo inicial (`INITIAL_BALANCE`) de un estudiante mediante un par de asientos contables equilibrados (Débito/Crédito) en el Ledger.
- **US-05:** Como Estudiante, quiero ver mi saldo actual y el historial inmutable de movimientos financieros.

### AgroRed (PYME) & Inventario WAC
- **US-06:** Como Miembro de AgroRed, quiero registrar un Producto y su Inventario inicial.
- **US-07:** Como Miembro de AgroRed, quiero registrar una Compra a un Proveedor, actualizando la cantidad física de inventario y recalculando el Costo Promedio Ponderado (WAC) con protección contra condiciones de carrera.
- **US-08:** Como Miembro de AgroRed, quiero registrar una Venta a un Estudiante, deduciendo el costo (COGS con WAC), reduciendo el inventario, generando la transacción de débito en la cuenta del estudiante y crédito en el ingreso de AgroRed de manera completamente atómica.

### Auditoría y Seguridad
- **US-09:** Como Sistema/Auditor, quiero que toda compra, venta y movimiento financiero genere un `AuditLog` inmutable.
- **US-10:** Como Estudiante, si intento invocar una API o acción para crear ventas o alterar inventarios, la petición debe ser rechazada por la UI, por los Guards de NestJS y por las políticas RLS de PostgreSQL.

---

## 4. Requisitos Funcionales Detallados

| ID | Requisito | Actor | Precondición | Flujo Principal | Criterio de Aceptación / Resultado |
|---|---|---|---|---|---|
| **RF-01** | Canje de Token de Registro | Estudiante no registrado | Token activo existente en `RegistrationToken` | 1. Ingresa token y datos.<br>2. Se verifica hash de token y fecha.<br>3. Se crea `User` en Supabase Auth.<br>4. Se vincula `userId` a `InstitutionalPerson`.<br>5. Token pasa a estado `USED`. | Token no reutilizable, hash nunca en texto plano, tasa de intentos limitada. |
| **RF-02** | Registro de Asiento Contable (Partida Doble) | Sistema / Transacción | Hecho económico (ej: Venta) | 1. Inicia `$transaction`.<br>2. Genera `Transaction` ID.<br>3. Inserta `LedgerEntry` (Débito en `StudentAccount`, Crédito en `AgroRed.RevenueAccount`).<br>4. Revisa que $\sum \text{DEBIT} = \sum \text{CREDIT}$. | Si no cuadra exacto, la transacción se aborta (`ROLLBACK`). Saldo derivado correcto. |
| **RF-03** | Recálculo de WAC con Locking | Miembro AgroRed | Producto existente en inventario | 1. Inicia transacción.<br>2. Adquiere lock explícito (`SELECT ... FOR UPDATE` sobre item/producto).<br>3. Calcula $(Q_1 \cdot C_1 + Q_2 \cdot C_2)/(Q_1 + Q_2)$.<br>4. Actualiza costo promedio e inventario. | Cero condiciones de carrera en compras/ventas concurrentes. |
| **RF-04** | Venta Atómica en AgroRed | Miembro AgroRed | Estudiante con saldo suficiente, producto con stock suficiente | 1. Recibe `Idempotency-Key`.<br>2. Si existe key, retorna respuesta previa.<br>3. Bloquea inventario y valida stock.<br>4. Genera `Sale` y `SaleItem`.<br>5. Genera `InventoryMovement` (`SALE`).<br>6. Genera `LedgerEntry` de partida doble.<br>7. Genera `AuditLog`. | Operación todo-o-nada. Sin inconsistencias parciales. |
| **RF-05** | Restricción de Tres Capas para Estudiante | Estudiante | Logueado con JWT de rol `STUDENT` | 1. Intenta ejecutar `POST /agrored/sales`.<br>2. Capa UI: Botón oculto.<br>3. Capa NestJS: Guard lanza `403 Forbidden`.<br>4. Capa RLS: Consulta directa rechazada por Postgres policy. | Bloqueo absoluto verificado en las 3 capas. |

---

## 5. Requisitos No Funcionales

- **Security:** Autenticación JWT vía Supabase Auth, RBAC + RLS en Postgres, sanitización de DTOs, Idempotency keys en mutaciones, secrets fuera del código.
- **Performance:** Tiempo de respuesta de endpoints transaccionales V0 < 300ms, dashboard de estudiante < 1.5s.
- **Data Integrity:** `NUMERIC(12,2)` para dinero, Ledger inmutable append-only, sin borrado físico de transacciones contables.
- **Auditability:** Registro automático en `AuditLog` para 100% de operaciones de mutación económica o de identidad.
- **Accessibility & UX:** Cumplimiento de WCAG 2.1 AA, soporte de teclado, soporte de `prefers-reduced-motion`, feedback de estados en UI (loading/error/empty/success).
