"use client";

import React from "react";
import { Check } from "lucide-react";

interface PasswordRequirementsProps {
  value: string;
}

/**
 * Quiet inline checklist shown only while the user is composing a password.
 * Renders as content (not a live region) to avoid announcing on every key.
 */
export function PasswordRequirements({ value }: PasswordRequirementsProps) {
  if (!value) return null;

  const checks = [
    { label: "8 o más caracteres", met: value.length >= 8 },
    { label: "Una letra mayúscula", met: /[A-Z]/.test(value) },
    { label: "Una letra minúscula", met: /[a-z]/.test(value) },
    { label: "Un número", met: /\d/.test(value) },
  ];

  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 mt-2.5 animate-tab-content">
      {checks.map((c) => (
        <li
          key={c.label}
          className={`flex items-center gap-1.5 text-[12px] transition-system ${
            c.met ? "font-medium text-[#2d6a4f]" : "text-[#8b968f]"
          }`}
        >
          <Check
            className={`w-3.5 h-3.5 shrink-0 ${
              c.met ? "text-[#2d6a4f]" : "text-[#c4ccc8]"
            }`}
            strokeWidth={c.met ? 2.5 : 2}
          />
          {c.label}
        </li>
      ))}
    </ul>
  );
}