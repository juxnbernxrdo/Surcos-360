import { Prisma } from '@prisma/client';

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

export const MONEY_REGEX = /^\d+(\.\d{1,2})?$/;

/**
 * Utilidades monetarias centrales del motor financiero.
 * Prohíben representar dinero con coma flotante (JS `number`) en la frontera
 * del sistema: entradas y salidas siempre son strings exactos (NUMERIC(12,2)).
 */
export class MoneyUtil {
  /**
   * Convierte una representación segura (string o Decimal) a Decimal exacto.
   * Acepta "12.34", "12", "0.01". Rechaza floats, exponentes y negativos.
   */
  static parse(value: string | Decimal): Decimal {
    const raw =
      value instanceof Decimal ? value.toString() : String(value).trim();
    if (!MONEY_REGEX.test(raw)) {
      throw new TypeError(
        `Monto monetario inválido '${raw}'. Formato esperado: dígitos con hasta 2 decimales (ej. "12.34").`,
      );
    }
    return new Decimal(raw);
  }

  /**
   * Serializa un Decimal como string fijo de 2 decimales (sin coma flotante).
   * Ej: Decimal("8.5") -> "8.50".
   */
  static toString(value: Decimal | string | number): string {
    if (typeof value === 'number') {
      // Nunca se deben pasar números a esta ruta en producción; se acepta
      // solo para no romper tests/legacy y se normaliza con 2 decimales.
      if (!Number.isFinite(value)) return '0.00';
      return value.toFixed(2);
    }
    const decimal = value instanceof Decimal ? value : new Decimal(value);
    return decimal.toFixed(2);
  }

  /** Suma una lista de valores monetarios de forma exacta. */
  static sum(values: Array<Decimal | string>): Decimal {
    return values.reduce<Decimal>(
      (acc, v) => acc.add(MoneyUtil.parse(v)),
      new Decimal(0),
    );
  }

  /** Valida el formato sin lanzar excepción. */
  static isValid(value: string): boolean {
    return MONEY_REGEX.test(value.trim());
  }

  /** Serializa un monto con signo (débitos negativos, créditos positivos). */
  static signed(value: Decimal | string, negative: boolean): string {
    const s = MoneyUtil.toString(value);
    return negative ? `-${s}` : s;
  }
}
