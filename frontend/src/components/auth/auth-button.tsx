"use client";

import React, { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

export interface AuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: "primary" | "outline" | "ghost";
}

export function AuthButton({
  children,
  isLoading = false,
  variant = "primary",
  disabled,
  className = "",
  ...props
}: AuthButtonProps) {
  const styles: Record<string, string> = {
    primary: "bg-[#0d2922] text-white rounded-pill px-8 pointer-hover:hover:bg-[#153b32]",
    outline:
      "bg-white text-[#111816] rounded-button px-6 ring-1 ring-inset ring-black/[0.12] pointer-hover:hover:ring-black/[0.22]",
    ghost:
      "bg-transparent text-[#4b5853] rounded-button px-6 pointer-hover:hover:text-[#111816] pointer-hover:hover:bg-black/[0.04]",
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`w-full h-12 text-[14px] font-semibold flex items-center justify-center gap-2 transition-system cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6a4f] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f6f7f6] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 ${styles[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>Procesando…</span>
        </>
      ) : (
        <span>{children}</span>
      )}
    </button>
  );
}