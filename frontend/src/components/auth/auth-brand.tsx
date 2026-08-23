"use client";

import React from "react";
import Link from "next/link";

interface AuthBrandProps {
  align?: "left" | "right";
  className?: string;
}

export function AuthBrand({ align = "left", className = "" }: AuthBrandProps) {
  const isRight = align === "right";

  return (
    <Link
      href="/"
      className={`group inline-flex ${
        isRight
          ? "flex-col items-end text-right"
          : "flex-col items-start text-left sm:flex-row sm:items-baseline sm:gap-2.5"
      } rounded-control focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6a4f] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f6f7f6] p-1 transition-system ${className}`}
      aria-label="Surcos 360 — volver al portal"
    >
      <span className="text-[17px] font-bold tracking-tight text-[#111816] pointer-hover:group-hover:text-[#0d2922] transition-system font-sans-ui leading-tight">
        Surcos 360
      </span>
      <span
        className={`text-[12px] font-normal text-[#66746e] font-sans-ui ${
          isRight
            ? "mt-0.5"
            : "sm:border-l sm:border-black/[0.08] sm:pl-2.5 sm:leading-none mt-0.5 sm:mt-0"
        }`}
      >
        Unidad Educativa Surcos
      </span>
    </Link>
  );
}