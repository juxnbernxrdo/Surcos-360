# Surcos 360 · Ecosistema Financiero y Académico Institucional

Plataforma integral de gestión contable por partida doble, ahorro estudiantil, comercio para microempresas escolares (PYMEs) y gobierno de identidad para la **Unidad Educativa Surcos**.

---

## 🏛️ Arquitectura del Sistema

```text
┌─────────────────────────────────────────────────────────────┐
│                      Surcos 360 Ecosystem                   │
├──────────────────────────────┬──────────────────────────────┤
│    Frontend (Next.js 16)     │     Backend (NestJS 11)      │
│  - App Router / React 19     │  - Modular Microservices     │
│  - Universal Input System    │  - Ledger Financial Engine   │
│  - Emil Kowalski Motion UI   │  - Auth & Zero-Trust Guards  │
│  - Tailwind CSS v4           │  - WAC Inventory & POS       │
├──────────────────────────────┴──────────────────────────────┤
│                Database & Security Core                     │
│  - PostgreSQL 17 + Row Level Security (RLS)                 │
│  - Prisma ORM 7 + Strict Immutability & Double-Entry        │
│  - Supabase Auth Integration & Token Management             │
└─────────────────────────────────────────────────────────────┘
```

### Dominios Principales

1. **Identity & Governance (`/auth`, `/students`):**
   * Multi-tenancy institucional (`@colegiosurcos.edu.ec`).
   * Autenticación unificada para Estudiantes, Docentes, Autoridades y Representantes Legales con tokens de invitación.
2. **General Ledger Contable (`/ledger`):**
   * Motor contable inmutable de partida doble ($\sum \text{Débitos} = \sum \text{Créditos}$).
   * Aislamiento transaccional con locks de fila y llaves de idempotencia.
3. **Ecosistema Comercial PYMEs (`/commercial`, `/organizations`):**
   * Catálogo, inventario y costeo ponderado (WAC).
   * Facturación escolar 0% IVA para AgroRed, Surcos Fit y Surcasino.
4. **Sistema de Diseño e Input Universal (`frontend/src/components/ui/input.tsx`):**
   * Input pill unificado, accesible (WAI-ARIA), con microinteracciones sub-200ms y feedback háptico visual.

---

## 🚀 Requisitos Previos

* **Node.js:** `v20.x` o superior.
* **npm:** `v10.x` o superior.
* **PostgreSQL:** `v16.x` / `v17.x` (o instancia de Supabase).

---

## 📦 Instalación y Configuración

### 1. Clonar el repositorio
```bash
git clone https://github.com/juxnbernxrdo/Surcos-360.git
cd Surcos-360
```

### 2. Configurar Variables de Entorno
Copia los archivos de plantilla y completa las credenciales correspondientes:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 3. Backend (NestJS & Prisma)
```bash
cd backend
npm install
npx prisma generate --schema=../prisma/schema.prisma
# Opcional: aplicar migraciones a base de datos local
# npx prisma migrate deploy
npm run start:dev
```

### 4. Frontend (Next.js 16)
```bash
cd ../frontend
npm install
npm run dev
```
La aplicación web estará disponible en `http://localhost:3000` y el backend en `http://localhost:4000`.

---

## 🧪 Pruebas y Control de Calidad

### Backend Quality Suite
```bash
cd backend
# 1. Typecheck & Build
npm run build

# 2. Linter (ESLint)
npm run lint

# 3. Pruebas Unitarias (17 suites / 127 tests)
npm test

# 4. Pruebas E2E & Seguridad (6 suites / 58 tests)
npm run test:e2e

# 5. Pruebas de Integración con PostgreSQL Real (opcional)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/s360_test" npm run test:integration
```

### Frontend Quality Suite
```bash
cd frontend
# 1. Linter (ESLint)
npm run lint

# 2. Next.js Production Build
npm run build
```

---

## 🌿 Flujo de Trabajo Git & Contribución

El repositorio utiliza una estrategia de ramificación profesional:

* **`main`:** Rama protegida de producción. Siempre estable y validada por CI.
* **`feature/*`:** Nuevas características y módulos de negocio.
* **`fix/*`:** Corrección de errores y bugs.
* **`refactor/*`:** Mejoras estructurales y optimización de código.
* **`chore/*`:** Mantenimiento de dependencias, scripts o CI.
* **`docs/*`:** Actualizaciones de especificaciones o documentación.

Todos los cambios deben integrarse mediante **Pull Requests** validados por la pipeline de **GitHub Actions** (`.github/workflows/ci.yml`).

---

## 🛡️ Licencia y Propiedad

Propiedad de la **Unidad Educativa Surcos**. Todos los derechos reservados.
