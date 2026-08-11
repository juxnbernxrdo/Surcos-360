# Constitution — Surcos 360

## Preámbulo
Esta Constitución establece los principios fundamentales, arquitectónicos, de seguridad, financieros, de datos, de calidad de código y de interfaz que rigen el desarrollo de **Surcos 360**. El objetivo primario es garantizar un sistema seguro, determinista, inmutable en su registro contable, accesible y mantenible, donde la fuente de verdad técnica y funcional esté completamente gobernada por este documento y el PRD v4 (`surcos-360-prd-v4.md`).

---

## 1. Principios de Arquitectura de Software

### 1.1 Monolito Modular
* Surcos 360 se estructurará como un **Monolito Modular** en el backend utilizando NestJS.
* Los dominios del sistema (`auth`, `users`, `identity`, `saving`, `ledger`, `inventory`, `agrored`, `audit`, etc.) estarán estrictamente acoplados por límites de módulo NestJS, evitando microservicios prematuros.
* Se permitirán transacciones ACID nativas de la base de datos entre módulos.

### 1.2 Capas de Aplicación
* **Frontend:** Next.js (App Router), con responsabilidad exclusiva de presentación, recolección de entrada, navegación e interacción del usuario. El frontend **nunca** es la autoridad de seguridad.
* **Backend:** NestJS como API gateway y capa de lógica de negocio principal, Guards de autorización, DTOs con validación estricta y servicios dominantes.
* **Base de Datos / Persistencia:** Supabase (PostgreSQL + Supabase Auth + RLS).
* **ORM:** Prisma como **única fuente de verdad del esquema de base de datos** (`schema.prisma`).

---

## 2. Modelo de Identidad Única e Institucional

### 2.1 Principio de Identidad No Duplicada
* **Surcos 360 nunca crea una segunda persona porque una fuente de datos distinta represente al mismo individuo.**
* Toda persona real en el ecosistema se representa mediante un registro único en `InstitutionalPerson`.

### 2.2 Desacoplamiento de Identidad y Roles
* `InstitutionalPerson` es el nodo central.
* La autenticación mediante Supabase Auth (`User`) es opcional y se vincula mediante `userId`.
* Los roles específicos dentro de la institución (`StudentRecord`, `TeacherRecord`, `AuthorityRecord`, `Customer`) y las membresías en PYMES (`Membership` -> `Organization`) son extensiones de `InstitutionalPerson`.
* Un usuario pertenece a **Surcos 360** a nivel global y solo adquiere roles específicos (`OWNER`, `ADMIN`, `MANAGER`, `EMPLOYEE`, `VIEWER`) dentro de organizaciones/PYMES mediante registros de `Membership`.

---

## 3. Seguridad y Autorización en Tres Capas

### 3.1 Criterio de Tres Capas (Defense in Depth)
Toda regla de acceso y restricción de rol (en especial las restricciones de `STUDENT` para no operar comercial o financieramente) debe ejecutarse y ser probada en tres capas independientes:
1. **Capa 1 (UI Frontend):** Ocultamiento/desactivación de componentes y controles interactivos según JWT / Claims.
2. **Capa 2 (Backend NestJS):** Validaciones obligatorias en Guards y Policies de NestJS en cada endpoint.
3. **Capa 3 (Base de Datos PostgreSQL / RLS):** Row Level Security (RLS) habilitado en Postgres. Ningún query ejecutado por la aplicación podrá saltarse RLS.

### 3.2 Prisma + Supabase RLS
* NestJS ejecutará transacciones/queries sensibles pasando las claims del JWT de Supabase Auth a Postgres (e.g. vía `SET LOCAL request.jwt.claims`) para garantizar que RLS resuelva `auth.uid()` al usuario real y no al rol administrativo global de Prisma.
* La clave `service_role` de Supabase está **estrictamente prohibida en el cliente frontend (Next.js)** y solo se usará en NestJS para tareas administrativas de infraestructura debidamente justificadas.

---

## 4. Gobernanza Financiera y Ledger de Partida Doble

### 4.1 Principio de Partida Doble Append-Only
* El sistema financiero de Surcos 360 se basa de forma innegociable en un **Ledger de Partida Doble append-only**.
* Toda transacción económica agrupa dos o más registros en `LedgerEntry` donde la ecuación fundamental es siempre estricta:
  $$\sum \text{DEBIT} = \sum \text{CREDIT}$$
* Está **estrictamente prohibido** mutar el campo `balance` de una cuenta como fuente de verdad. Los saldos de las cuentas (`StudentAccount`, cuentas de PYME) son siempre balances derivados de la suma de sus `LedgerEntry`.

### 4.2 Precisión Numérica
* **Queda strictly prohibido el uso de tipos `FLOAT` o `DOUBLE` para representar dinero.**
* Todos los valores monetarios deben almacenarse como `NUMERIC(12,2)` o como enteros representando centavos (`integer cents`).

### 4.3 Idempotencia Transaccional
* Toda operación mutable sobre dinero o inventario **debe requerir obligatoriamente** una `Idempotency-Key` provista en la cabecera o payload de la solicitud.
* Las respuestas a solicitudes con la misma `Idempotency-Key` y `actorId` deben ser idénticas y no reejecutar efectos secundarios.

---

## 5. Gestión de Inventarios y Costo Promedio Ponderado (WAC)

### 5.1 Método WAC
* Las valoraciones de inventarios y Costo de Ventas (COGS) en las PYMES (e.g., AgroRed) se calcularán exclusivamente mediante **Weighted Average Cost (WAC)**.
* Todo movimiento físico de stock genera un `InventoryMovement` inmutable (`PURCHASE`, `SALE`, `ADJUSTMENT`, `RETURN`, etc.).

### 5.2 Control de Concurrencia y Transacciones ACID
* El cálculo y actualización del WAC debe estar protegido contra condiciones de carrera mediante el uso explícito de bloqueos en la base de datos (`SELECT ... FOR UPDATE` o `pg_advisory_xact_lock`) dentro de una transacción atómica ($transaction Prisma con raw locks).

---

## 6. Auditoría Completa y Trazabilidad

### 6.1 Auditoría Obligatoria
* Operaciones sensibles (creación/edición/suspensión de usuarios, modificaciones de roles, operaciones financieras, compras, ventas, cambios de inventario o precios, login/logout, canje de tokens) deben registrar obligatoriamente una entrada en `AuditLog`.
* El `AuditLog` debe incluir: `actorId`, `organizationId`, `action`, `entity`, `entityId`, `previousState`, `newState`, `ipAddress`, `userAgent` y `timestamp`.

---

## 7. Estándares y Reglas de Desarrollo Frontend y UX (Skills Obligatorias de Emil Kowalski)

### 7.1 Dependencia Obligatoria de Skills
Todo trabajo frontend en Surcos 360 (**Specify, Plan, Tasks, Analyze, Implement, Converge**) debe utilizar obligatoriamente las skills de Emil Kowalski según aplique:
- `emil-design-eng` (Referencia principal para diseño de interacción, jerarquía y motion).
- `animate` (Implementación de animaciones con propiedades, easing y timing explícito).
- `review-animations` & `improve-animations` (Auditoría y eliminación de motion ornamental innecesario).
- `find-animation-opportunities` (Identificación estratégica de microinteracciones).
- `prototype` (Creación de variaciones genuinas de UI antes de construir).
- `animation-vocabulary` (Descripción precisa del movimiento).
- `apple-design` (Claridad visual, interacción fluida y jerarquía).
- `pick-ui-library` (Evaluación de componentes existentes antes de construir desde cero).

### 7.2 Regla de Motion (Animación Funcional)
* **Motion por propósito:** Toda animación debe ser funcional (confirmar, explicar, conectar cambios de estado). Queda prohibida la animación puramente decorativa o que ralentice flujos críticos.
* **Sustento de accesibilidad:** Todo componente con animación debe soportar obligatoriamente la preferencia del sistema `prefers-reduced-motion`.

### 7.3 Gate Obligatorio de Frontend
Ninguna tarea frontend puede marcarse como completada sin pasar el **Gate de Frontend**:
- [ ] Skills de Emil Kowalski aplicadas.
- [ ] Sin motion innecesario / Soporte `prefers-reduced-motion`.
- [ ] Retroalimentación contextual (loading, error, empty, success).
- [ ] Accesibilidad (WCAG AA), responsive y navegación por teclado verificados.

---

## 8. Calidad de Código y Reglas de Implementación

### 8.1 TypeScript Estricto
* Modo TypeScript `strict: true`. Prohibido el uso de `any` explícito o implícito.

### 8.2 Principio de No Infección de Bugs / No Parches Superficiales
* Prohibido silenciar errores con bloques try/catch vacíos, devolver fallbacks silenciosos ante fallos críticos o alterar pruebas para ignorar fallos.
* Ante un error de compilación o runtime, se debe identificar la causa raíz en la cadena de datos y resolver la causa subyacente.

### 8.3 Inmutabilidad del PRD y SDD
* No se escribirá código sin antes haber pasado por el proceso SDD: Spec -> Clarify -> Plan -> Checklist -> Tasks -> Analyze.
* Ninguna decisión de código puede reemplazar arbitrariamente una definición explícita del PRD v4.
