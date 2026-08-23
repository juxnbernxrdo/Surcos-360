"use client";

import React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { AuthButton } from "./auth-button";

interface SuccessScreenProps {
  title: string;
  description: string;
  note?: string;
  actionHref: string;
  actionLabel: string;
  actionVariant?: "primary" | "outline";
}

/**
 * Dedicated success state — replaces the form in place so the transition
 * keeps spatial continuity (no box, no card: same column, new content).
 */
export function SuccessScreen({
  title,
  description,
  note,
  actionHref,
  actionLabel,
  actionVariant = "primary",
}: SuccessScreenProps) {
  return (
    <div className="auth-enter-2 text-left">
      <Check className="w-10 h-10 text-[#2d6a4f]" strokeWidth={2} />

      <h2 className="mt-5 text-[24px] lg:text-[26px] font-bold tracking-[-0.02em] leading-[1.15] text-[#111816]">
        {title}
      </h2>

      <p className="mt-3 text-[14px] text-[#4b5853] leading-relaxed max-w-[36ch]">
        {description}
      </p>

      {note && (
        <p className="mt-3 text-[12.5px] text-[#66746e] leading-relaxed max-w-[40ch]">
          {note}
        </p>
      )}

      <div className="mt-7">
        <Link href={actionHref} className="block w-full">
          <AuthButton type="button" variant={actionVariant}>
            {actionLabel}
          </AuthButton>
        </Link>
      </div>
    </div>
  );
}