"use client";

import React, { forwardRef } from "react";
import { Input, InputProps } from "@/components/ui/input";

export type FormFieldProps = InputProps;

/**
 * Backward-compatible FormField adapter over the universal Input component.
 */
export const FormField = forwardRef<HTMLInputElement, FormFieldProps>((props, ref) => {
  return <Input ref={ref} {...props} />;
});

FormField.displayName = "FormField";
