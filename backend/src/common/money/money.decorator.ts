import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { MONEY_REGEX } from './money.util';

/**
 * Valida montos monetarios como strings exactos (sin coma flotante).
 * Formato aceptado: "0.01", "12", "12.34", "999.99".
 */
@ValidatorConstraint({ name: 'IsMoney', async: false })
export class IsMoneyConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return MONEY_REGEX.test(value.trim());
  }

  defaultMessage(): string {
    return 'El monto debe ser una cadena numérica exacta con hasta 2 decimales (ej. "12.34").';
  }
}

export function IsMoney(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsMoneyConstraint,
    });
  };
}
