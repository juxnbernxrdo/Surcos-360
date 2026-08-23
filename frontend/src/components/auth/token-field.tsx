"use client";

import React, { forwardRef } from "react";
import { Check } from "lucide-react";
import { Input, InputProps } from "@/components/ui/input";

export interface TokenFieldProps
  extends Omit<InputProps, "onChange" | "value" | "endAdornment" | "isLoading"> {
  value: string;
  onChangeValue: (value: string) => void;
  isValidating?: boolean;
  isValid?: boolean;
}

/**
 * Universal TokenField implementing invitation token entry with
 * uppercase/whitespace sanitizer and inmutable verification checkmark.
 */
export const TokenField = forwardRef<HTMLInputElement, TokenFieldProps>(
  (
    {
      label = "Token de Invitación",
      value,
      onChangeValue,
      error,
      isValidating = false,
      isValid = false,
      helperText = "Encuentra tu código en el correo de invitación enviado por la institución.",
      className = "",
      required = true,
      ...props
    },
    ref
  ) => {
    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text").trim();
      if (text) {
        onChangeValue(text);
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const cleanValue = e.target.value.replace(/\s+/g, "");
      onChangeValue(cleanValue);
    };

    const showValidState = isValid && !error && !isValidating && value.trim().length >= 8;

    const validAdornment = showValidState ? (
      <div className="flex items-center justify-center pr-1 pointer-events-none">
        <Check className="w-4 h-4 text-[#2d6a4f] shrink-0 animate-tab-content" strokeWidth={2.5} />
      </div>
    ) : undefined;

    return (
      <Input
        ref={ref}
        label={label}
        name="token"
        type="text"
        value={value}
        onChange={handleChange}
        onPaste={handlePaste}
        autoComplete="one-time-code"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="Pega o escribe tu código de invitación"
        error={error}
        success={showValidState}
        helperText={helperText}
        isLoading={isValidating}
        endAdornment={validAdornment}
        required={required}
        className={`font-mono-code font-medium tracking-[0.02em] placeholder:font-sans-ui placeholder:font-normal placeholder:tracking-normal ${className}`}
        {...props}
      />
    );
  }
);

TokenField.displayName = "TokenField";
