"use client";

import React from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

interface AuthNoticeProps {
  type: "error" | "success" | "info";
  message: string | string[];
  onDismiss?: () => void;
}

export function AuthNotice({ type, message, onDismiss }: AuthNoticeProps) {
  if (!message || (Array.isArray(message) && message.length === 0)) return null;

  const isError = type === "error";
  const isSuccess = type === "success";

  const tone = isError
    ? { text: "text-[#b42318]", icon: <AlertCircle className="w-4 h-4 shrink-0 mt-[2px]" /> }
    : isSuccess
    ? { text: "text-[#2d6a4f]", icon: <CheckCircle2 className="w-4 h-4 shrink-0 mt-[2px]" /> }
    : { text: "text-[#334e68]", icon: <Info className="w-4 h-4 shrink-0 mt-[2px]" /> };

  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 text-[13px] leading-relaxed animate-tab-content ${tone.text}`}
    >
      {tone.icon}
      <div className="flex-grow">
        {Array.isArray(message) ? (
          <ul className="list-disc list-inside space-y-1">
            {message.map((m, idx) => (
              <li key={idx}>{m}</li>
            ))}
          </ul>
        ) : (
          <p>{message}</p>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          type="button"
          aria-label="Descartar aviso"
          className="p-1 rounded-control text-black/40 pointer-hover:hover:text-black/70 transition-system cursor-pointer shrink-0 -mt-0.5 -mr-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-current/30"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}