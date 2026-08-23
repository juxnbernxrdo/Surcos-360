"use client";

import React, { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthBrand } from "./auth-brand";

interface AuthLayoutProps {
  kicker: string;
  title: string;
  subtitle: string;
  statement: string;
  children: ReactNode;
  footerContent?: ReactNode;
  backHref?: string;
  backLabel?: string;
}

/**
 * Auth shell — Open canvas two-column composition:
 * - LEFT: Pure functional authentication flow (forms, actions, validation, states).
 * - RIGHT: Institutional branding, messages aligned to the right, and dynamic animated brand gradient.
 * - MOBILE: Clean single-column stack without clutter or keyboard obstruction.
 */
export function AuthLayout({
  kicker,
  title,
  subtitle,
  statement,
  children,
  footerContent,
  backHref,
  backLabel,
}: AuthLayoutProps) {
  return (
    <div className="min-h-dvh bg-[#f6f7f6] text-[#111816] font-sans-ui selection:bg-[#badac3] selection:text-[#061915]">
      <div className="lg:grid lg:grid-cols-2 min-h-dvh">

        {/* LEFT COLUMN — Functional Authentication Flow */}
        <section className="min-h-dvh flex flex-col justify-between px-6 sm:px-10 lg:px-12 xl:px-16 py-8 sm:py-10 bg-[#f6f7f6] relative z-10">
          {/* Mobile brand header */}
          <div className="lg:hidden flex items-center justify-between pb-4">
            <AuthBrand align="left" />
          </div>

          {/* Form / Task container */}
          <div className="my-auto w-full max-w-[420px] mx-auto py-6 sm:py-8 lg:py-0">
            {/* Heading block */}
            <div className="auth-enter-1">
              {backHref && (
                <Link
                  href={backHref}
                  className="group inline-flex items-center gap-1.5 mb-7 text-[13px] font-medium text-[#66746e] pointer-hover:group-hover:text-[#111816] transition-system rounded-control py-1 pr-1 -ml-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6a4f]"
                >
                  <ArrowLeft className="w-4 h-4 transition-transform duration-150 ease-out pointer-hover:group-hover:-translate-x-0.5" />
                  {backLabel}
                </Link>
              )}

              <p className="font-mono-code text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2d6a4f]">
                {kicker}
              </p>

              <h1 className="mt-3 text-[28px] sm:text-[30px] lg:text-[32px] font-bold tracking-[-0.02em] leading-[1.12] text-[#111816]">
                {title}
              </h1>

              <p className="mt-3 text-[14px] lg:text-[15px] text-[#4b5853] leading-relaxed max-w-[38ch]">
                {subtitle}
              </p>
            </div>

            {/* Form / state content */}
            <div className="auth-enter-2 mt-8">
              {children}
            </div>

            {/* Secondary navigation / footer links */}
            {footerContent && (
              <div className="auth-enter-3 mt-8 pt-2">
                {footerContent}
              </div>
            )}
          </div>

          {/* Mobile legal footer */}
          <div className="lg:hidden flex items-center justify-center pt-6 text-[11.5px] text-[#66746e]">
            <span>&copy; {new Date().getFullYear()} Unidad Educativa Surcos</span>
          </div>
        </section>

        {/* RIGHT COLUMN — Institutional Branding & Messages with Animated Gradient */}
        <aside className="hidden lg:flex relative flex-col justify-between min-h-dvh px-10 xl:px-16 py-10 overflow-hidden border-l border-black/[0.06] bg-[#f6f7f6]">
          {/* Animated organic brand gradient backdrop — Intensified Surcos 360 Aurora */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
            {/* Ambient base wash */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#ebf7ee] via-[#f2f7f4] to-[#d8f3dc]/50" />

            {/* Blob 1: Sage & Emerald luminous glow */}
            <div className="absolute -top-[12%] -right-[15%] w-[500px] h-[500px] xl:w-[600px] xl:h-[600px] rounded-full bg-gradient-to-br from-[#52b788]/40 via-[#2d6a4f]/25 to-transparent blur-[64px] animate-brand-aurora-1 will-change-transform" />

            {/* Blob 2: Fresh Mint & Pine energetic glow */}
            <div className="absolute top-[30%] -right-[10%] w-[460px] h-[460px] xl:w-[560px] xl:h-[560px] rounded-full bg-gradient-to-tr from-[#d8f3dc]/90 via-[#52b788]/35 to-[#1b4d3e]/20 blur-[72px] animate-brand-aurora-2 will-change-transform" />

            {/* Blob 3: Deep Forest & Emerald depth */}
            <div className="absolute -bottom-[12%] right-[8%] w-[440px] h-[440px] xl:w-[520px] xl:h-[520px] rounded-full bg-gradient-to-tl from-[#ebf7ee] via-[#2d6a4f]/25 to-[#52b788]/20 blur-[68px] animate-brand-aurora-3 will-change-transform" />

            {/* Soft ambient gradient overlay to guarantee maximum legibility */}
            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#f6f7f6]/10 to-[#f6f7f6]/40 pointer-events-none" />
          </div>

          {/* Top: Branding aligned to the right */}
          <div className="relative z-10 flex justify-end auth-enter-1">
            <AuthBrand align="right" />
          </div>

          {/* Middle: Institutional message aligned to the right */}
          <div className="relative z-10 flex flex-col items-end text-right auth-enter-2 my-auto py-12 max-w-[42ch] ml-auto">
            <p className="font-serif-display italic text-[28px] xl:text-[34px] leading-[1.3] text-[#0d2922] text-right">
              {statement}
            </p>
          </div>

          {/* Bottom: Copyright line aligned to the right */}
          <div className="relative z-10 auth-enter-3 flex items-center justify-end border-t border-black/[0.06] pt-5 text-[12px] text-[#66746e]">
            <span className="whitespace-nowrap">
              &copy; {new Date().getFullYear()} Unidad Educativa Surcos
            </span>
          </div>
        </aside>

      </div>
    </div>
  );
}