# Surcos 360 — PRD v4.0 (Documento Maestro)

**Estado:** Documento de definición de producto — versión fusionada
**Plataforma:** Web responsive
**Stack:** Next.js · NestJS · Prisma · Supabase (Postgres + Auth + RLS) · Gemini · LangChain · RAG (pgvector)
**Basado en:** PRD v1.0 (visión y alcance funcional) + PRD v3.0 (revisión de arquitectura y seguridad) — fusionados, simplificados y ampliados en este documento.

---

## 0. Cómo leer este documento

Este PRD reemplaza a los dos anteriores. No son dos capas separadas ("visión" + "correcciones"): las decisiones de arquitectura ya están integradas directamente en cada sección funcional. Donde una versión anterior contradecía a la otra (identidad, ledger), aquí solo queda una versión, marcada como **decisión de arquitectura**.

Convención usada en todo el documento:

> 🔒 **Decisión de arquitectura** — algo no negociable para V0, con la razón por la que lo es.
> ⚠️ **Riesgo/pendiente** — algo que el equipo o la institución debe resolver antes de construir esa parte.

---

## 1. Resumen ejecutivo

**Surcos 360** es la plataforma central para el ecosistema empresarial, financiero y educativo de Surcos. Centraliza usuarios, estudiantes, docentes, autoridades, representantes, organizaciones/PYMES (inventario, activos, pasivos, proveedores, compras, ventas), cuentas financieras de estudiantes, reportes, auditoría y un módulo de IA con lenguaje natural y RAG documental.

Organizaciones iniciales:

1. **Surcos Saving** — financiera central del ecosistema.
2. **Surcos Fit** — gimnasio escolar.
3. **AgroRed** — PYME comercial/agrícola.
4. **Surcasino** — alquiler de juegos y material recreativo.

> ⚠️ El nombre "Surcasino" puede generar ruido con padres/autoridades independientemente de que la función sea inocua (alquiler de Jenga, ajedrez, balones). Confirmar con la institución antes de lanzarlo así — es un cambio de una línea, no vale la pena el riesgo reputacional gratuito.

El diseño conceptual es sólido: separación identidad/membresía/cuenta financiera, ledger append-only, IA con scope de datos. El riesgo principal **no es de diseño, es de alcance**: tomado literalmente, este documento describe un ERP + CRM + motor contable de partida doble + identidad con matching difuso + orquestador de IA con RAG + 4 PYMES completas, todo como "Fase 1". Este documento resuelve eso definiendo un **V0 real** (sección 9) antes del roadmap completo.

---

## 2. Problema

Hoy las operaciones de las PYMES escolares y la administración de estudiantes están dispersas en hojas de cálculo y registros manuales. Esto impide conocer el estado financiero real, saber quién hizo cada operación, controlar inventarios y costos, administrar proveedores, consultar movimientos de estudiantes, generar reportes confiables, controlar permisos, detectar inconsistencias y tomar decisiones con datos.

---

## 3. Objetivos

### 3.1 Objetivo principal
Crear una plataforma centralizada para gestionar el ecosistema Surcos 360 y sus organizaciones desde una única aplicación.

### 3.2 Objetivos específicos

**Usuarios:** registro con cualquier correo; perfiles de estudiante/docente/representante/autoridad; administración global desde Surcos Saving; gestión de permisos y roles.

**PYMES:** miembros, productos, inventario, activos, pasivos, proveedores, compras, ventas, gastos, resultados financieros.

**Estudiantes:** consultar saldo, monto inicial, ahorro, gastos, movimientos, actividad, rendimiento e interacción con PYMES. **No realizan operaciones comerciales directamente.**

**IA:** preguntas en lenguaje natural, análisis financiero, consulta de datos, generación de reportes, búsqueda documental (RAG), respuestas contextualizadas — siempre dentro del alcance de permisos del usuario que pregunta.

---

## 4. Modelo de identidad

🔒 **Decisión de arquitectura.** El PRD original contenía dos modelos de identidad no reconciliados: uno simple (`User → STUDENT/TEACHER/...`) y otro introducido más adelante para la importación XLSX (`InstitutionalPerson`, `StudentRecord`, matching engine). Se adopta **un único modelo, el segundo**, como fuente de verdad:

> **Surcos 360 nunca crea una persona nueva solo porque una fuente de datos distinta la representa.** Existe una identidad institucional (`InstitutionalPerson`) que puede tener, opcionalmente, una cuenta de autenticación (`User` en Supabase Auth), uno o más registros de rol, un perfil de cliente y una o más membresías — sin duplicarse nunca.

```text
InstitutionalPerson
   ├── userId?            → User (Supabase Auth) — puede no existir aún
   ├── studentRecordId?   → StudentRecord (curso, tutor, estado)
   ├── teacherRecordId?
   ├── authorityRecordId?
   ├── customerId?        → Customer (compras en PYMES)
   └── memberships[]      → Membership → Organization (rol: OWNER/ADMIN/MANAGER/EMPLOYEE/VIEWER)
```

**Simplificación para V0:** si el registro siempre exige una llave exacta de vinculación (código institucional o correo institucional), el "matching engine" con scoring difuso (`REQUIRES_REVIEW`, 94% de coincidencia, etc.) **no es necesario en la primera versión**. Es una fuente considerable de bugs y trabajo de UI para un problema resoluble con match exacto. Empezar solo con match exacto; agregar fuzzy matching únicamente si en la práctica llegan estudiantes con datos sucios que no cruzan.

### 4.1 Regla fundamental
Un usuario **pertenece a Surcos 360**. No pertenece automáticamente a ninguna PYME.

```text
Juan Pérez
└── Surcos 360 → STUDENT
    ├── AgroRed      → cliente
    ├── Surcos Fit   → cliente
    └── Surcasino    → cliente
```

### 4.2 Cliente vs. miembro de organización

- **Cliente:** recibe servicios o realiza operaciones comerciales *a través de* un miembro de la PYME.
- **Miembro:** persona autorizada para operar dentro de una organización (registra ventas, compras, etc.).

```text
Juan  → Surcos 360: STUDENT   | AgroRed: cliente
María → Surcos 360: STUDENT   | AgroRed: EMPLOYEE  (puede registrar operaciones)
```

### 4.3 Tipos de usuario y roles organizacionales

```text
Tipo de usuario (Surcos 360):  STUDENT | TEACHER | REPRESENTATIVE | AUTHORITY
                                (posteriormente: STAFF | ADMIN | OTHER)

Rol organizacional (por PYME):  OWNER | ADMIN | MANAGER | EMPLOYEE | VIEWER
```

**Tipo de usuario ≠ rol dentro de una PYME.** Las PYMES son operadas principalmente por estudiantes de último año, que tienen tipo `STUDENT` pero rol `MANAGER`/`EMPLOYEE` en su organización.

### 4.4 Registro

Disponible con cualquier correo electrónico, sin exigir dominio institucional (`juan@gmail.com`, `pedro@colegio.edu` son ambos válidos). Campos: email, contraseña, nombre, apellido, tipo de usuario, curso (si corresponde). Los permisos iniciales son siempre restrictivos; los roles elevados requieren autorización explícita.

### 4.5 Tokens de incorporación

🔒 **Decisión de arquitectura.** En vez de un sistema paralelo de tokens "por actor" (uno para estudiantes, otro para docentes, otro para PYMES...), una sola tabla polimórfica:

```text
RegistrationToken
  id
  type        STUDENT | TEACHER | AUTHORITY | REPRESENTATIVE | PYME_MEMBER
  tokenHash   (nunca texto plano)
  status      ACTIVE | USED | EXPIRED | REVOKED
  maxUses
  expiresAt
  createdBy
  metadata    jsonb  (studentId, organizationId, rol asignado, etc. según type)
```

Menos tablas, misma trazabilidad, y un único punto para aplicar rate limiting y throttling contra fuerza bruta en el canje de tokens.

### 4.6 Administración global (Surcos Saving)

Usuarios autorizados en Surcos Saving pueden: ver/crear/editar/suspender/reactivar usuarios, gestionar roles y organizaciones, consultar movimientos e información global, administrar información financiera y usar IA sobre datos autorizados. El sistema debe distinguir explícitamente entre `Global permissions` y `Organization permissions` — dos tablas/enums separados, no un solo rol "admin" ambiguo.

---

## 5. Módulo de estudiantes

**Perfil:** nombre, apellido, email, curso, tutor, estado.

**Dashboard del estudiante:**

```text
Hola, Juan
Curso: 3ro BGU · Tutor: María González

Monto inicial   $100
Monto ahorrado   $75
Gastos           $25

Actividad
AgroRed        -$8.50
Surcos Fit     -$5.00
Surcasino      -$3.00
```

**El estudiante puede:** consultar su información, movimientos, actividad, estadísticas, saldo y reportes propios.

**El estudiante NO puede:** crear ventas, registrar compras, modificar inventarios ni precios, registrar pagos comerciales, modificar movimientos financieros, crear productos ni proveedores, registrar alquileres. Esta restricción se aplica en **tres capas** (ver §11.2), no solo ocultando botones en el frontend.

---

## 6. Módulo empresarial común (todas las PYMES)

Todas las PYMES comparten: productos, inventarios, activos, pasivos, proveedores, compras, ventas/servicios, gastos, pagos, reportes y auditoría.

### 6.1 Inventarios

Cada organización puede tener uno o varios inventarios (ej. AgroRed: principal, bodega, refrigerados). Cada ítem: nombre, descripción, tipo, categoría, SKU, unidad, cantidad, estado, precio de compra/venta, valor actual, proveedor.

Tipos base: `PRODUCT · RAW_MATERIAL · SUPPLY · SPARE_PART · EQUIPMENT · FURNITURE · SPORTS_MATERIAL · GAME · CONSUMABLE · FIXED_ASSET · OTHER` (extensible por organización).

Estados: `ACTIVE · INACTIVE · AVAILABLE · IN_USE · DAMAGED · MAINTENANCE · LOST · DISPOSED · SOLD`.

Todo cambio de inventario genera un `InventoryMovement` (`PURCHASE · SALE · ADJUSTMENT · RETURN · LOSS · TRANSFER · DISPOSAL`) con producto, cantidad, unidad, stock anterior/posterior, costo, referencia, usuario y fecha.

Unidades soportadas: `UNIT · DOZEN · GRAM · KILOGRAM · POUND · LITER · MILLILITER · METER · BOX · BAG · PACKAGE · HOUR · OTHER`.

### 6.2 Proveedores, compras y pasivos

Proveedor: nombre, empresa, contacto, email, teléfono, identificación fiscal, dirección, estado.

Flujo de compra: `Proveedor → Compra → Productos → Inventario → Cuenta por pagar → Pago`. Una compra registra proveedor, fecha, productos, cantidades, costo unitario, subtotal, impuestos, descuentos, total, forma de pago, estado y usuario.

Compra a crédito → genera pasivo; al pagar, el pasivo se reduce y sale de caja/banco (modelado como partida doble, §8).

### 6.3 Ventas y ganancia automática

Una venta: cliente, productos/servicios, cantidad, precio, descuento, impuesto, total, usuario, fecha. El cliente puede ser `STUDENT · TEACHER · REPRESENTATIVE · OTHER`.

El sistema calcula automáticamente `Ganancia bruta = Ingresos − Costo de ventas (COGS)`.

### 6.4 Costo promedio ponderado (WAC) — con control de concurrencia

Costeo por **Weighted Average Cost**. Ejemplo: 100 u. a $2.00 + 100 u. a $2.50 → costo total $450 / 200 u. = **$2.25** de costo promedio.

🔒 **Decisión de arquitectura — riesgo no cubierto en el PRD original.** Dos ventas simultáneas del mismo producto pueden leer el mismo WAC antes de que la primera termine de actualizarlo (condición de carrera clásica). Se debe usar explícitamente una de estas dos estrategias dentro de la transacción de venta/compra:

```text
Opción A: SELECT ... FOR UPDATE sobre la fila de inventario del producto
          (bloquea la fila hasta que la transacción termina).

Opción B: Advisory lock por productId durante el cálculo del WAC
          (pg_advisory_xact_lock).
```

Nota de implementación con Prisma: el ORM no soporta `FOR UPDATE` de forma nativa en su API estándar; requiere `$queryRaw`/`$executeRaw` dentro de un `$transaction`. Documentarlo así para que no se pierda al construir.

### 6.5 Activos y pasivos

**Activos:** equipos, muebles, máquinas, juegos, vehículos, computadores, otros — con nombre, tipo, código, serial, fecha y costo de adquisición, valor actual, estado, ubicación, proveedor, responsable.

**Pasivos:** cuentas por pagar, préstamos, créditos, obligaciones — con nombre, tipo, monto, proveedor, fecha, vencimiento, estado.

### 6.6 Gastos

Gastos operativos (electricidad, agua, internet, mantenimiento, transporte, publicidad, materiales, otros). Un gasto genera una transacción del ledger (§8) y afecta los reportes financieros.

---

## 7. Organizaciones específicas

### 7.1 Surcos Saving — financiera central
Administra fondos y cuentas estudiantiles, consulta movimientos y PYMES, genera reportes, consulta estudiantes, hace análisis, administración global e IA.

**Cuenta financiera del estudiante:** `StudentAccount` con saldo derivado siempre del ledger (§8), nunca de un campo mutable independiente.

**Regla financiera:** los estudiantes no crean movimientos. Los movimientos los generan Surcos Saving, las organizaciones, miembros autorizados o procesos internos. El estudiante únicamente consulta el resultado.

> ⚠️ **Pregunta abierta que el PRD original no resolvía:** ¿"Surcos Saving" mueve dinero real? Si solo administra un saldo simbólico interno (moneda cerrada, sin retiro a cuentas bancarias reales) es un sistema de puntos sin mayor implicación regulatoria. Si en algún momento involucra cuentas bancarias reales, depósitos de terceros o retiros a favor de menores, empieza a rozar actividad financiera regulada. La institución debe confirmarlo **por escrito** antes de construir los módulos de banco/efectivo — cambia el nivel de cumplimiento requerido (esto no es asesoría legal).

### 7.2 Surcos Fit — gimnasio
Inventario, activos, clientes, planes, membresías, visitas, pagos, reportes.

`StudentVisit`: estudiante, check-in, check-out, registrado por, fecha (el estudiante solo la visualiza).

Pago: plan, monto, estudiante, fecha, periodo, usuario que registró (siempre un miembro de Fit, nunca el estudiante).

### 7.3 AgroRed — comercial/agrícola
Productos, unidades, peso, inventario, proveedores, compras, ventas, clientes (estudiantes, docentes, representantes), costos, ganancias — usando el motor común de §6.

### 7.4 Surcasino — alquiler
Ítems: juegos de mesa, pelotas, Jenga, ajedrez, mesas, otros. Alquiler: cliente, ítem, inicio, fin, duración, precio/hora, total, registrado por.

---

## 8. Motor financiero: ledger de partida doble

🔒 **Decisión de arquitectura — la más importante de este documento.** El PRD original modelaba cada movimiento como un registro suelto con `amount` + `type` (`DEPOSIT`, `PURCHASE`, etc.). Sirve para mostrar un historial, pero **no permite cuadrar cuentas de forma matemáticamente garantizada**, que es justamente el objetivo de un ledger append-only.

```text
LedgerEntry
  id
  transactionId      → agrupa las líneas de un mismo hecho económico
  accountId          → cuenta afectada (StudentAccount, CashAccount, RevenueAccount, etc.)
  direction          → DEBIT | CREDIT
  amount             → siempre positivo, NUMERIC(12,2) o enteros en centavos
  createdAt
  referenceType / referenceId
```

Ejemplo — compra de un estudiante en AgroRed por $8.50:

```text
Transaction TX-00042
  DEBIT   StudentAccount(Juan)     $8.50
  CREDIT  AgroRed.RevenueAccount   $8.50
```

**Regla de integridad:** la suma de débitos siempre igual a la suma de créditos dentro de una transacción. Esto convierte la conciliación en una consulta SQL trivial en lugar de un proceso manual, y hace que un bug de cálculo sea detectable automáticamente (si no cuadra, algo está roto).

Tipos de hecho económico que generan transacciones: `INITIAL_BALANCE · DEPOSIT · WITHDRAWAL · PURCHASE · REFUND · TRANSFER · ADJUSTMENT · OTHER`.

> Esta es la única pieza del sistema que **no** conviene posponer ni simplificar de más: migrar de "amount + type" a partida doble después de tener datos reales en producción es mucho más costoso que diseñarlo bien desde la primera transacción.

### 8.1 Idempotencia

Toda operación que muta dinero o inventario debe soportar una `Idempotency-Key` de cliente. Implementación mínima:

```text
IdempotencyKey(key, actorId, endpoint, responseHash, createdAt)
  UNIQUE (key, actorId, endpoint)
```

Si llega una key repetida, se devuelve la respuesta original sin reejecutar la operación.

### 8.2 Transacciones atómicas

Una operación comercial debe ser atómica de punta a punta (todo o nada). Ejemplo — registrar una venta:

```text
Registrar venta
├── Sale
├── SaleItems
├── InventoryMovement
├── LedgerEntry (débito/crédito balanceado)
├── Cálculo de ganancia (COGS con WAC)
└── AuditLog
```

Si algo falla → `ROLLBACK` completo. No puede existir una venta sin actualizar inventario, ni un movimiento de ledger sin su contrapartida.

---

## 9. Alcance V0 — de 160+ secciones a un walking skeleton real

El PRD original, tomado literalmente, describe un ERP + CRM + motor contable de partida doble + identidad con matching difuso + orquestador de IA con RAG + 4 PYMES completas, todo antes de validar que el modelo funciona con usuarios reales. Eso es meses de trabajo de un equipo completo, no un MVP.

**Recomendación: construir un flujo completo de punta a punta con el alcance mínimo, antes de sumar ancho.**

```text
V0 real (un corte transversal delgado, no las 5 fases completas)

1. Auth (Supabase) + un solo tipo de registro: Student, por link tokenizado
2. Importación de estudiantes: CSV simple (nombre, curso, monto inicial),
   SIN preview avanzado ni matching difuso — match exacto por email/código
3. StudentAccount + Ledger de partida doble
   (solo INITIAL_BALANCE, DEPOSIT, WITHDRAWAL, PURCHASE)
4. Una sola PYME funcionando completo: AgroRed
   (productos, inventario, compra, venta con WAC + locking, actividad)
5. Auditoría básica de las operaciones anteriores
```

Todo lo demás —Surcos Fit, Surcasino, retenciones, conciliación de caja, aprobaciones, presupuestos por periodo, ciclo académico/promoción, notificaciones, feature flags, IA, RAG— se construye **después** de validar que Auth → Import → Ledger → PYME funciona en producción con usuarios reales. Es más fácil y más barato descubrir un problema de modelo de datos con una PYME que con cuatro.

### 9.1 Cosas que se pueden posponer sin perder nada hoy

- Ciclo académico completo (`AcademicYear`, `AcademicTerm`, promoción, graduación) — un campo `course` de texto alcanza al inicio; la modelación completa se justifica en el segundo año lectivo.
- Workflow de aprobaciones multinivel — con una sola PYME y montos pequeños, no hay nada que aprobar todavía.
- `InterOrganizationTransfer` entre PYMES — no existe hasta que haya más de una PYME activa.
- Feature flags — útiles con releases frecuentes a producción con usuarios activos, no durante la construcción inicial.
- Matching difuso de identidad (§4) — solo si en la práctica hace falta.

### 9.2 Fases posteriores (roadmap, no V0)

```text
Fase 1 — Core:        auth, usuarios, perfiles, organizaciones, roles, permisos, tokens, auditoría
Fase 2 — Saving:       cuentas, ledger, movimientos, dashboard, reportes
Fase 3 — Motor:        productos, inventario, proveedores, compras, ventas, activos, pasivos, gastos
Fase 4 — PYMES:        Surcos Fit, Surcasino (AgroRed ya vive en V0)
Fase 5 — IA:           Gemini, LangChain, SQL tools, RAG, pgvector, chat, reportes IA
```

---

## 10. Principios de arquitectura de software

### 10.1 Monolito modular antes que microservicios

NestJS se organiza en módulos por dominio (`saving`, `agrored`, `surcos-fit`, `ai`, etc.). **No desplegarlos como servicios separados.** Un monolito modular reduce la complejidad operativa (un solo deploy, una sola base de datos, transacciones ACID reales entre módulos — crítico para el ledger) y permite dividir en servicios más adelante *solo si* un módulo concreto (ej. `ai`) necesita escalar o aislarse por costo/latencia. Divide por **límites de módulo NestJS**, no por microservicio, hasta tener una razón operativa concreta.

### 10.2 Postgres/Supabase como fuente de verdad para autorización, no solo el backend

Dos capas de defensa, no una:

```text
Capa 1 — Aplicación (NestJS)
  Guards + decoradores de permisos por endpoint. Rechaza antes de tocar la BD.

Capa 2 — Base de datos (Postgres RLS)
  Policies por tabla basadas en auth.uid()/claims del JWT.
  Última línea de defensa, incluso si la Capa 1 falla.
```

> ⚠️ **Punto que ni el PRD v1 ni el v3 resolvían del todo:** Prisma normalmente abre un pool de conexiones con **un rol fijo** (el de la app), lo que en la práctica **bypassea RLS** salvo que se configure explícitamente. Para que RLS aplique de verdad por usuario con Prisma + Supabase hace falta uno de estos patrones:
> - Ejecutar cada request dentro de una transacción que haga `SET LOCAL request.jwt.claims = '...'` (o el mecanismo equivalente de Supabase) con el JWT verificado del usuario antes de correr la query — así `auth.uid()` resuelve al usuario real dentro de esa transacción.
> - Usar un pool de conexión "sin privilegios" para lecturas sensibles vía PostgREST/Supabase client (no Prisma) cuando el dato es de bajo riesgo.
> Sin esto, "tenemos RLS" es una afirmación falsa en la práctica: las policies existen en el esquema pero nunca se activan porque todo corre como el rol de servicio. Definir este patrón **antes** de escribir el primer módulo, no después.

### 10.3 Separación estricta cliente/servidor en Next.js

- La `service_role key` de Supabase **nunca** llega al cliente. Solo se usa desde NestJS (o desde funciones server-only de Next.js si se decide no pasar por NestJS para ciertas lecturas).
- Next.js habla con NestJS para toda escritura financiera o lectura sensible; puede hablar directo con Supabase (RLS + `anon key`) para datos públicos o de solo lectura de bajo riesgo.
- Exponer la `service_role key` en una API route mal configurada es el error de seguridad más común en proyectos Next.js + Supabase — dejarlo explícito en el PRD, no asumido.

### 10.4 Dinero: nunca `FLOAT`

```text
NUMERIC(12,2) en Postgres, o enteros en centavos (integer) en el dominio.
```

`FLOAT`/`DOUBLE` producen errores de redondeo acumulados, inaceptables en un ledger append-only que se supone inmutable y auditable. Ecuador usa USD, así que no hay conversión de moneda que complique esto — una razón más para no dejarlo pasar.

### 10.5 Migraciones y esquema

Prisma como única fuente de verdad del esquema; todo cambio de tabla pasa por migración versionada, nunca por cambios manuales en Supabase Studio en producción. Ambientes: `local → staging → production`, con `staging` usando datos anonimizados si se necesitan datos realistas (§11.6).

### 10.6 Testing dirigido por riesgo

No hace falta 100% de cobertura. Sí, de forma obligatoria antes de cualquier release:

- pruebas unitarias exhaustivas del **motor de ledger** (saldos, WAC, retenciones, reversals);
- pruebas de integración de **flujos transaccionales** (venta = inventario + ledger + auditoría, todo o nada);
- pruebas automatizadas de **RLS policies** (que un usuario de la PYME A no pueda leer datos de la PYME B) — no solo revisión manual.

### 10.7 CI/CD mínimo

```text
En cada PR:  lint → typecheck → tests unitarios → tests de integración (BD de prueba)
En merge a main → staging:  migración automática + deploy + smoke test
Deploy a producción: manual/aprobado, con posibilidad de rollback de migración
```

### 10.8 Observabilidad mínima viable

Para V0 basta con: logs estructurados (pino) con `requestId` y `actorId`; captura de errores (Sentry o similar); alertas simples si un job de importación o de IA falla. Tracing distribuido y métricas custom tienen sentido cuando haya tráfico real que lo justifique — no antes.

### 10.9 Manejo de errores y contrato de API

Formato de error consistente en toda la API NestJS (código, mensaje, `requestId`) para que el frontend y la IA (cuando reporte fallos de sus "tools") puedan manejarlos de forma predecible, en vez de mensajes ad-hoc por endpoint.

---

## 11. Seguridad

### 11.1 Capas de seguridad end-to-end

```text
Supabase Auth → JWT → NestJS Guards → Role permissions → Organization scope
              → Prisma → PostgreSQL/RLS
```

Nunca confiar en permisos enviados por el frontend.

### 11.2 Restricciones del estudiante en tres capas

La regla "el estudiante no puede vender/comprar/modificar inventario" (§5) se aplica: (1) ocultando la UI, (2) rechazando en el Guard de NestJS por rol, y (3) bloqueando a nivel de RLS aunque alguien llame al endpoint directo con el JWT del estudiante. Las tres capas son necesarias — la UI y el Guard pueden tener bugs; RLS es la red de seguridad final.

### 11.3 Sesiones en computadoras compartidas

Relevante porque muchos estudiantes usarán laboratorios escolares compartidos:

- tiempo de expiración de sesión corto para el rol `STUDENT` frente a roles administrativos;
- botón de cierre de sesión visible y logout automático por inactividad;
- "recordarme" persistente desactivado por defecto.

### 11.4 IA/RAG: la restricción de datos debe ser técnica, no solo de prompt

Decir "la IA nunca debe tener acceso irrestricto" en el system prompt no es suficiente si alguien manipula el prompt o el flujo de retrieval.

🔒 **Regla dura:** toda consulta que el orquestador de IA ejecute contra Postgres corre **bajo el rol/JWT del usuario real**, no con una conexión de servicio con privilegios amplios. Así, aunque el LLM genere una consulta incorrecta o sea víctima de *prompt injection* desde un documento del RAG, las **RLS policies de Postgres siguen aplicando** (misma capa 2 de §10.2, también para la IA).

Controles adicionales:

```text
- El LLM no genera SQL arbitrario contra tablas: llama a "tools" (funciones)
  predefinidas y de solo lectura, con parámetros validados.
- Límite de filas devueltas por consulta (evita exfiltración masiva).
- Contenido recuperado por RAG se trata como dato, nunca como instrucción
  (separación estricta entre system prompt y contenido de documentos).
- Cada llamada de IA queda en AuditLog: actor, pregunta, tools invocadas, filas devueltas.
- Rate limit y presupuesto de costo por organización/día para llamadas a Gemini.
```

Flujo de autorización por pregunta:

```text
User → Authentication → Authorization → Data scope → AI tool

"¿Cuánto he gastado?" (estudiante)                       → Sí
"¿Cuánto tienen todos los estudiantes?" (estudiante)      → No
"¿Cuánto vendió AgroRed este mes?" (Surcos Saving, con permiso) → Sí
```

### 11.5 Datos de menores de edad — marco legal (Ecuador)

Casi todos los usuarios son menores de edad y el sistema maneja sus datos financieros. Esto activa la **Ley Orgánica de Protección de Datos Personales (LOPDP)** de Ecuador, que exige tratamiento reforzado para datos de niños, niñas y adolescentes, incluyendo consentimiento del representante legal.

- Vincular el consentimiento del representante al flujo de invitación de representantes ya definido — documentarlo como requisito legal, no solo funcional.
- Definir política de retención: cuánto tiempo se conserva el ledger de un estudiante graduado (probablemente años, por obligaciones contables — validar con la institución).
- Derecho de acceso/rectificación para representantes sobre los datos de su representado.
- Términos de servicio y política de privacidad, necesarios antes de recolectar datos de menores aunque el sistema sea interno.

*(Orientación general, no asesoría legal — validar con el equipo administrativo/legal de la institución antes de lanzar.)*

### 11.6 Datos de prueba

Nunca usar datos reales de estudiantes en `staging`/desarrollo. Para probar el importador CSV/XLSX, generar datos sintéticos o anonimizar (nombres ficticios, mismo shape de datos).

### 11.7 Rate limiting y throttling

Throttling por IP y por token en canje de `RegistrationToken` (§4.5), en endpoints de autenticación, y presupuesto diario de llamadas a Gemini por organización (§11.4). NestJS `@nestjs/throttler` cubre el primer nivel; el segundo es lógica de negocio propia.

---

## 12. Inteligencia artificial y RAG

### 12.1 Preguntas en lenguaje natural

Ejemplos: *¿Cuánto vendió AgroRed este mes?* · *¿Cuál fue la ganancia de AgroRed?* · *¿Qué productos tienen mayor margen?* · *¿Qué estudiantes gastaron más?* · *¿Cuánto se gastó en Surcos Fit?* · *¿Qué juegos fueron más alquilados?*

### 12.2 IA + SQL

```text
Pregunta → AI Orchestrator → Permission check → Data tool (función predefinida) → PostgreSQL → Gemini → Respuesta
```

Gemini nunca tiene acceso libre a la base (ver regla dura en §11.4).

### 12.3 RAG documental

Para conocimiento no estructurado: reglamentos, manuales, políticas, procedimientos, documentación administrativa.

```text
Documento → Parser → Chunks → Embeddings → pgvector → Retriever → Gemini
```

### 12.4 IA híbrida

Ejemplo: *¿Cuánto vendió AgroRed y cuál es la política de devoluciones?* → `SQL (ventas) + RAG (política) → Gemini → respuesta integrada`.

### 12.5 Generación de reportes por IA

*Genera el informe mensual de AgroRed* → resumen ejecutivo, ventas, compras, inventario, productos principales, ganancia, gastos, pasivos, tendencias, observaciones — generado sobre datos ya obtenidos vía tools, no inventado por el modelo.

---

## 13. Arquitectura técnica

```text
                    NEXT.JS
                       │
                       ▼
                 NESTJS API
                       │
          ┌────────────┼─────────────┐
          │            │             │
        Prisma       Auth           AI
          │            │             │
          ▼            ▼             ▼
      Supabase      Supabase       LangChain
      PostgreSQL       Auth           │
          │         (RLS activo)      ▼
          │                         Gemini
          │                           │
          ▼                        pgvector
       Storage
```

### 13.1 Backend NestJS — módulos

```text
auth · users · profiles · students · organizations · memberships · invitations
saving · accounts · ledger · transactions
inventory · products · assets · liabilities
suppliers · purchases · sales · expenses · payments
surcos-fit · surcasino · agrored
reports · audit · notifications
ai · rag · embeddings
```

### 13.2 Frontend Next.js — rutas

```text
/auth/login  /auth/register
/dashboard
/students  /users  /organizations
/saving/accounts  /saving/transactions  /saving/reports
/fit/visits  /fit/plans  /fit/payments
/agrored/products  /agrored/inventory  /agrored/suppliers  /agrored/purchases  /agrored/sales
/surcasino/items  /surcasino/rentals
/assets  /liabilities  /expenses  /reports  /audit  /ai  /settings
```

Las rutas se muestran según permisos (Capa 1 de §10.2), reforzadas por RLS del lado del dato (Capa 2).

### 13.3 Modelo de datos principal

```text
InstitutionalPerson · User · StudentRecord · TeacherRecord · AuthorityRecord · Course · Tutor

Organization · Membership · RegistrationToken
Permission (Global / Organization)

StudentAccount · LedgerEntry · Transaction · IdempotencyKey

Product · ProductCategory · Inventory · InventoryItem · InventoryMovement
Asset · Liability
Supplier · Purchase · PurchaseItem
Customer · Sale · SaleItem
Expense · Payment

GymPlan · GymMembership · GymVisit
GameItem · Rental

AuditLog
Document · DocumentChunk
AIConversation · AIMessage
```

---

## 14. Auditoría y reportes

### 14.1 Auditoría obligatoria

Deben auditarse siempre: crear/modificar/eliminar, compras, ventas, cambios de inventario o precios, pagos, movimientos financieros, cambios de usuarios/permisos, altas y bajas de miembros.

```text
AuditLog: actor, organización, acción, entidad, id, estado anterior, estado nuevo, fecha, IP, user agent
```

Ejemplo: *Juan Pérez creó el producto "Huevos" en AgroRed.* / *María López modificó el precio de Tomate de $2.50 a $2.80.*

### 14.2 Activity feed
Actividad reciente por organización (ventas, compras, ajustes de inventario, cambios de precio).

### 14.3 Reportes

- **Estudiante:** monto inicial, ahorro, gastos, saldo, gastos por empresa, actividad.
- **PYME:** ventas, compras, inventario, activos, pasivos, gastos, ingresos, costos, ganancia.
- **Global (Surcos Saving):** estudiantes, fondos, PYMES, ventas, compras, ganancias, actividad.

---

## 15. Requisitos no funcionales

**Seguridad:** autenticación segura, autorización RBAC, auditoría completa, protección de información financiera, sesiones seguras, rate limiting, validación de entradas.

**Rendimiento (objetivos iniciales):** dashboard < 2s en condiciones normales; CRUD < 1s cuando sea posible; reportes optimizados; IA con streaming cuando sea posible.

**Disponibilidad:** backups, recuperación, logs, monitoreo, manejo de errores.

> ⚠️ **No cubierto en las versiones anteriores — definir explícitamente:**
> - **Backups/DR:** definir RPO/RTO mínimo y verificar que los backups automáticos de Supabase cubren la necesidad, o configurar backups adicionales específicos para el ledger.
> - **Multi-tenancy futuro:** el PRD asume una sola institución. Si el roadmap V3 implica vender Surcos 360 a otros colegios, el modelo de RLS debe diseñarse **ahora** con `institutionId` en cada tabla, aunque hoy solo exista una institución — agregarlo después es una migración dolorosa y riesgosa sobre datos financieros reales.
> - **Offboarding de miembros de PYME:** el flujo de alta (tokens de incorporación) está cubierto; falta definir la baja — ¿qué pasa con los permisos de un estudiante de 3ro BGU que se gradúa o deja su rol de `MANAGER`? Definir expiración/revocación explícita de `Membership`.
> - **Notificaciones:** si se van a enviar (recordatorios de pago, alertas de inventario), definir proveedor (email/push) desde ya aunque no se construya en V0 — afecta el modelo de datos de `User`/`InstitutionalPerson` (opt-in, canal preferido).

---

## 16. Criterios de aceptación

**Registro:** [ ] cualquier correo · [ ] perfil creado automáticamente · [ ] permisos iniciales restrictivos · [ ] roles elevados requieren autorización.

**Estudiantes:** [ ] consultan su información, movimientos y gastos · [ ] no pueden crear operaciones comerciales (verificado en las 3 capas de §11.2).

**PYMES:** [ ] gestionan miembros, productos, inventarios, proveedores · [ ] registran compras y ventas · [ ] gestionan activos y pasivos.

**Finanzas:** [ ] compras afectan inventario y pueden generar pasivos · [ ] pagos reducen pasivos · [ ] ventas generan ingresos y reducen inventario · [ ] se calcula COGS con WAC bajo locking (§6.4) · [ ] se calcula ganancia bruta · [ ] toda transacción de ledger cuadra en débitos = créditos · [ ] todo queda auditado.

**IA:** [ ] respeta permisos vía RLS con JWT del usuario real (§11.4) · [ ] consulta datos reales mediante tools, nunca SQL libre · [ ] usa RAG para documentos · [ ] responde consultas híbridas · [ ] no accede a información fuera del alcance del usuario.

---

## 17. Métricas de éxito

**Plataforma:** usuarios activos y registrados, organizaciones activas, operaciones diarias, operaciones auditadas.

**PYMES:** ventas, compras, margen, inventario, rotación, proveedores.

**Estudiantes:** ahorro, gasto, actividad, participación.

**IA:** preguntas realizadas y respondidas correctamente, uso de reportes generados, consultas por organización, tiempo de respuesta.

---

## 18. Roadmap posterior a V0

```text
V2 — notificaciones, dashboards avanzados, exportación Excel/PDF, gráficos,
     alertas de inventario y financieras.

V3 — IA avanzada: recomendaciones, detección de anomalías, predicciones,
     análisis de rentabilidad. (Diseñar institutionId desde V0 si aquí se
     contempla vender a otros colegios — ver §15.)

V4 — app móvil, QR, pagos, escaneo de productos, códigos de barras,
     control de acceso, automatizaciones.
```

---

## 19. Checklist accionable

```text
[ ] Adoptar InstitutionalPerson como único modelo de identidad (match exacto en V0)
[ ] Ledger de partida doble (Debit/Credit) en vez de amount+type
[ ] NUMERIC(12,2) o centavos para todo monto — nunca FLOAT
[ ] Definir el patrón concreto de RLS + Prisma (SET LOCAL del JWT por transacción)
    antes de escribir el primer módulo
[ ] RLS activo en Postgres para todas las tablas sensibles, con tests automatizados
[ ] Conexión de IA a la base ejecuta bajo el rol/JWT del usuario, no con service_role
[ ] Locking explícito (FOR UPDATE / advisory lock) en cálculo de WAC, vía $queryRaw en Prisma
[ ] Idempotency-Key con constraint único en operaciones críticas
[ ] service_role key nunca en el cliente Next.js
[ ] Consentimiento del representante legal vinculado al registro de estudiantes (LOPDP)
[ ] Confirmar por escrito con la institución si "Surcos Saving" maneja dinero real o solo saldo interno
[ ] institutionId en el esquema desde el día uno, aunque solo haya una institución
[ ] Definir offboarding/revocación de Membership
[ ] Definir RPO/RTO y backups específicos del ledger
[ ] V0 = Auth + import simple + ledger partida doble + AgroRed funcionando de punta a punta
```

---

## 20. Nota final

El diseño conceptual original es sólido: la separación identidad/membresía/cuenta financiera, el enfoque append-only y la idea de IA con scope de datos son decisiones correctas. El riesgo real nunca fue de diseño — fue de **alcance** y de un par de contradicciones internas (identidad duplicada, ledger sin partida doble) que este documento resuelve dejando una única versión de cada decisión. Este PRD v4.0 no cambia la visión: la acota a algo que un equipo pequeño puede construir, asegurar y probar con datos reales antes de seguir creciendo, y sirve como documento maestro para pasar al diseño del ERD/Prisma, la arquitectura de NestJS, los permisos y las pantallas de Next.js.
