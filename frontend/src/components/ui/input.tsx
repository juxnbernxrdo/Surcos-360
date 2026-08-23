"use client";

import React, { forwardRef, useState, useId, InputHTMLAttributes } from "react";
import { Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";

export type InputSize = "default" | "sm";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Label descriptivo del campo */
  label?: string;
  /** Mensaje de error (activa estado aria-invalid y borde de error) */
  error?: string;
  /** Indicador de éxito (borde verde sutil y estado afirmativo) */
  success?: boolean;
  /** Texto descriptivo o guía debajo del campo */
  helperText?: string;
  /** Elemento opcional ubicado al extremo derecho de la fila de label (ej. enlaces "¿Olvidaste contraseña?") */
  hint?: React.ReactNode;
  /** Ícono o elemento visual fijo al inicio del campo */
  startAdornment?: React.ReactNode;
  /** Ícono o elemento visual fijo al final del campo */
  endAdornment?: React.ReactNode;
  /** Estado de carga asíncrona (spinner en endAdornment) */
  isLoading?: boolean;
  /** Tamaño del input (default: 48px, sm: 40px) */
  inputSize?: InputSize;
  /** Si es true y type="password", habilita el botón integrado para alternar visibilidad */
  enablePasswordToggle?: boolean;
}

/**
 * Universal Input System para Surcos 360
 * 
 * Cumple con los principios de diseño e ingeniería de Emil Kowalski:
 * - Cero layout shift (dimensiones y paddings estables en todos los estados).
 * - Focus ring nítido con box-shadow exterior de precisión y brand accent #2d6a4f.
 * - Soporte WAI-ARIA (aria-invalid, aria-describedby, aria-required).
 * - Microinteracciones sub-200ms con curva spring natural.
 * - Password reveal integrado accesible con teclado y aria-pressed.
 * - Respeto irrestricto por prefers-reduced-motion y autofill styling.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      success,
      helperText,
      hint,
      startAdornment,
      endAdornment,
      isLoading = false,
      inputSize = "default",
      enablePasswordToggle = false,
      id,
      type = "text",
      className = "",
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}` : generatedId);
    const describedBy = error
      ? `${inputId}-error`
      : helperText
      ? `${inputId}-helper`
      : undefined;

    // Estado interno para visibilidad de contraseña
    const [showPassword, setShowPassword] = useState(false);
    const isPasswordType = type === "password";
    const resolvedType = isPasswordType && enablePasswordToggle && showPassword ? "text" : type;

    // Alturas de campo y paddings
    const heightClass = inputSize === "sm" ? "h-10 text-[13.5px]" : "h-12 text-[14.5px]";

    // Renderizado condicional del end adornment (Password toggle > Loader > Custom endAdornment)
    let finalEndAdornment = endAdornment;

    if (isLoading) {
      finalEndAdornment = (
        <div className="flex items-center justify-center text-[#2d6a4f] pointer-events-none">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      );
    } else if (isPasswordType && enablePasswordToggle) {
      finalEndAdornment = (
        <button
          type="button"
          tabIndex={0}
          onClick={() => setShowPassword((prev) => !prev)}
          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={showPassword}
          disabled={disabled}
          className="p-2 mr-1 text-[#66746e] pointer-hover:hover:text-[#111816] rounded-full transition-system cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6a4f] active:scale-95 disabled:pointer-events-none disabled:opacity-40"
        >
          {showPassword ? (
            <EyeOff className="w-[18px] h-[18px]" />
          ) : (
            <Eye className="w-[18px] h-[18px]" />
          )}
        </button>
      );
    }

    const hasStartAdornment = Boolean(startAdornment);
    const hasEndAdornment = Boolean(finalEndAdornment);

    // Dynamic padding when adornments are present (pill curved edges have comfortable px-5 padding)
    const plClass = hasStartAdornment ? "pl-11" : "pl-5";
    const prClass = hasEndAdornment ? "pr-11" : "pr-5";

    return (
      <div className="w-full text-left group/input-field">
        {/* Label & Hint Row */}
        {(label || hint) && (
          <div className="flex items-baseline justify-between gap-4 mb-1.5">
            {label && (
              <label
                htmlFor={inputId}
                className="text-[13px] font-medium tracking-[-0.01em] text-[#111816] select-none inline-flex items-center"
              >
                <span>{label}</span>
                {required && (
                  <span aria-hidden="true" className="ml-0.5 text-[#2d6a4f] font-semibold">
                    *
                  </span>
                )}
              </label>
            )}
            {hint && (
              <div className="text-[12px] text-[#66746e] shrink-0 font-normal">
                {hint}
              </div>
            )}
          </div>
        )}

        {/* Input Wrapper */}
        <div className="relative flex items-center">
          {/* Start Adornment */}
          {hasStartAdornment && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-[#66746e]">
              {startAdornment}
            </div>
          )}

          {/* Core Input Element */}
          <input
            ref={ref}
            id={inputId}
            type={resolvedType}
            disabled={disabled}
            required={required}
            aria-invalid={!!error}
            aria-required={required || undefined}
            aria-describedby={describedBy}
            className={`w-full ${heightClass} ${plClass} ${prClass} bg-white text-[#111816] rounded-full border border-[var(--input-border)] placeholder:text-[#8b968f] font-sans-ui transition-system focus:outline-none focus:border-[var(--input-focus)] focus:ring-1 focus:ring-[var(--input-focus)] focus:bg-white enabled:pointer-hover:hover:border-[var(--input-border-hover)] disabled:bg-black/[0.02] disabled:border-[var(--input-border-disabled)] disabled:text-[#9aa59f] disabled:placeholder:text-[#b8c0bb] disabled:cursor-not-allowed ${
              error
                ? "border-[var(--input-error)] focus:border-[var(--input-error)] focus:ring-1 focus:ring-[var(--input-error)]"
                : success
                ? "border-[var(--input-success)] enabled:pointer-hover:hover:border-[var(--input-success)]"
                : ""
            } ${className}`}
            {...props}
          />

          {/* End Adornment */}
          {hasEndAdornment && (
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center">
              {finalEndAdornment}
            </div>
          )}
        </div>

        {/* Feedback / Error / Helper Section */}
        {error ? (
          <div
            id={`${inputId}-error`}
            role="alert"
            className="flex items-start gap-1.5 mt-1.5 text-[12.5px] font-medium text-[#b42318] animate-tab-content"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-[1px]" />
            <span>{error}</span>
          </div>
        ) : helperText ? (
          <p
            id={`${inputId}-helper`}
            className="mt-1.5 text-[12.5px] text-[#66746e] leading-relaxed select-none"
          >
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
