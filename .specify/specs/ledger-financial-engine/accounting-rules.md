# Accounting Rules & Posting Logic (accounting-rules.md)
## Surcos 360 — General Ledger & Financial Engine

**Documento:** `.specify/specs/ledger-financial-engine/accounting-rules.md`  
**Versión:** 2.0  

---

## 1. Convención de Débito y Crédito por Tipo de Cuenta

| Tipo de Cuenta (`AccountType`) | Naturaleza Contable | Efecto de DÉBITO (`DEBIT`) | Efecto de CRÉDITO (`CREDIT`) |
| :--- | :--- | :--- | :--- |
| **`ASSET`** (Activo) | Deudora | **Aumenta (+)** | **Disminuye (-)** |
| **`LIABILITY`** (Pasivo) | Acreedora | **Disminuye (-)** | **Aumenta (+)** |
| **`EQUITY`** (Patrimonio) | Acreedora | **Disminuye (-)** | **Aumenta (+)** |
| **`REVENUE`** (Ingresos) | Acreedora | **Disminuye (-)** | **Aumenta (+)** |
| **`EXPENSE`** (Gastos / COGS) | Deudora | **Aumenta (+)** | **Disminuye (-)** |
| **`STUDENT_WALLET`** (Billetera Estudiantil) | Deudora (Billetera del estudiante) | **Aumenta (+)** (Depósito) | **Disminuye (-)** (Consumo/Retiro) |

> **Nota sobre `StudentAccount`:** Dentro del contexto de la billetera personal del estudiante en Surcos Saving, los depósitos representan un débito a la cuenta de efectivo central (`SAVING_CENTRAL_VAULT`) y un crédito al saldo individual del estudiante (`direction: CREDIT` sobre `StudentAccount` o débito según la convención del extracto bancario). En Surcos 360, el saldo se calcula matemáticamente como:
> 
> $$\text{Saldo Estudiante} = \sum \text{Créditos (Depósitos/Abonos)} - \sum \text{Débitos (Consumos/Retiros)}$$

---

## 2. Reglas de Contabilización por Operación de Negocio

### 2.1 Depósito en Billetera de Estudiante (`DEPOSIT`)
* **Hecho Económico:** El representante o estudiante entrega fondos líquidos a la tesorería de Surcos Saving para acreditar a su cuenta personal.
* **Asientos:**
  1. `Dr. SAVING_CENTRAL_VAULT` (Activo $\uparrow$) por el monto recibido.
  2. `Cr. StudentAccount` (Billetera/Pasivo de custodia $\uparrow$) por el monto recibido.
* **Invariante:** Monto $> 0$. Requiere row lock sobre la cuenta del estudiante.

### 2.2 Retiro de Billetera de Estudiante (`WITHDRAWAL`)
* **Hecho Económico:** Se devuelven fondos líquidos al estudiante o representante legal.
* **Asientos:**
  1. `Dr. StudentAccount` (Billetera/Pasivo $\downarrow$) por el monto a retirar.
  2. `Cr. SAVING_CENTRAL_VAULT` (Activo $\downarrow$) por el monto entregado.
* **Invariante:** $\text{Saldo Disponible} \ge \text{Monto a retirar}$. Rechaza con `400 Bad Request` si no hay fondos suficientes.

### 2.3 Venta POS con Billetera Estudiantil (`SALE`)
* **Hecho Económico:** El estudiante adquiere productos, alimentos o servicios en una PYME (ej. AgroRed).
* **Asientos:**
  1. `Dr. StudentAccount` (Billetera $\downarrow$) por el total de la venta.
  2. `Cr. <PYME>_REVENUE` (Ingresos Operativos $\uparrow$) por el total de la venta.
* **Asientos de Costo de Ventas (COGS automático):**
  1. `Dr. <PYME>_COGS` (Gasto Costo de Ventas $\uparrow$) por $\text{Cantidad} \times \text{WAC}$.
  2. `Cr. <PYME>_INVENTORY_ASSET` (Inventario Circulante $\downarrow$) por $\text{Cantidad} \times \text{WAC}$.

### 2.4 Venta POS en Efectivo (`SALE`)
* **Hecho Económico:** Un cliente compra al contado en una PYME.
* **Asientos:**
  1. `Dr. <PYME>_CASH_VAULT` (Caja PYME $\uparrow$) por el total cobrado.
  2. `Cr. <PYME>_REVENUE` (Ingresos Operativos $\uparrow$) por el total cobrado.
* **Asientos COGS:** Idem punto 2.3 si se vendió inventario regular.

### 2.5 Compra de Mercadería a Proveedor (`PURCHASE`)
* **Hecho Económico:** La PYME adquiere existencias para revender.
* **Si es al Contado:**
  1. `Dr. <PYME>_INVENTORY_ASSET` (Inventario $\uparrow$) por el monto de compra.
  2. `Cr. <PYME>_CASH_VAULT` (Caja PYME $\downarrow$) por el monto pagado.
* **Si es a Crédito:**
  1. `Dr. <PYME>_INVENTORY_ASSET` (Inventario $\uparrow$) por el monto de compra.
  2. `Cr. <PYME>_ACCOUNTS_PAYABLE` (Cuentas por Pagar $\uparrow$) por la obligación contraída.
* **Efecto en WAC:** Actualiza el costo unitario ponderado bajo lock pesimista de fila.

### 2.6 Pago de Pasivo a Proveedor (`LIABILITY_PAYMENT`)
* **Hecho Económico:** La PYME amortiza una deuda pendiente con un proveedor comercial.
* **Asientos:**
  1. `Dr. <PYME>_ACCOUNTS_PAYABLE` (Pasivo $\downarrow$) por el monto liquidado.
  2. `Cr. <PYME>_CASH_VAULT` (Caja PYME $\downarrow$) por el monto desembolsado.

### 2.7 Registro de Gasto Operativo (`EXPENSE`)
* **Hecho Económico:** La PYME incurre en costos de operación, mantenimiento o suministros.
* **Asientos:**
  1. `Dr. <PYME>_OPERATING_EXPENSE` (Gastos $\uparrow$) por el valor del gasto.
  2. `Cr. <PYME>_CASH_VAULT` (Caja PYME $\downarrow$) por el desembolso realizado.

### 2.8 Venta de Activo Patrimonial (`ASSET_SALE`)
* **Hecho Económico:** Enajenación autorizada de un bien duradero o amortizado.
* **Asientos:**
  1. `Dr. <PYME>_CASH_VAULT` o `StudentAccount` (Cobro recibido).
  2. `Cr. <PYME>_ASSET_SALE_REVENUE` (Ingreso extraordinario reconocido).
* **Efecto Patrimonial:** El activo cambia a estado `AssetStatus.SOLD` sin afectar el stock de inventario circulante.

### 2.9 Reversión Contable (`REVERSAL`)
* **Hecho Económico:** Anulación o corrección de una transacción previa.
* **Regla:** Genera una nueva transacción de tipo `REVERSAL` con `reversalOfId` apuntando a la transacción original. Por cada asiento original, genera un asiento idéntico pero con `direction` invertida (`DEBIT` $\leftrightarrow$ `CREDIT`).
