"use client";

import React, { forwardRef } from "react";
import { Input, InputProps } from "@/components/ui/input";

export type PasswordFieldProps = Omit<InputProps, "type" | "enablePasswordToggle">;

/**
 * Backward-compatible PasswordField adapter over the universal Input component.
 */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>((props, ref) => {
  return <Input ref={ref} type="password" enablePasswordToggle {...props} />;
});

PasswordField.displayName = "PasswordField";
