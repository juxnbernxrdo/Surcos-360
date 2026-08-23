"use client";

import React, { ReactNode } from "react";
import { AuthProvider } from "@/context/auth-context";

export function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
