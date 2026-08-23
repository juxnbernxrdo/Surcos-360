"use client";

import React from "react";

export function Footer() {
  return (
    <footer className="bg-[#f6f7f6] text-[#4b5853] border-t border-black/[0.06] pt-14 pb-10 text-[13px] font-sans-ui">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 pb-10 border-b border-black/[0.06]">
          
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-3">
            <div>
              <span className="font-bold text-[#111816] text-[16px] tracking-tight">Surcos 360</span>
            </div>
            <p className="text-[12px] text-[#66746e] leading-relaxed max-w-sm">
              Plataforma enterprise de la Unidad Educativa Surcos. Unifica el ahorro estudiantil, las operaciones de las PYMES escolares y la contabilidad de partida doble inmutable.
            </p>
          </div>

          {/* Ecosistema Col */}
          <div className="space-y-2.5">
            <div className="font-mono-code text-[11px] font-bold text-[#111816] uppercase tracking-wider">
              Ecosistema
            </div>
            <ul className="space-y-1.5 text-[12px]">
              <li>
                <a href="#ecosistema" className="hover:text-[#0d2922] hover:underline transition-system">
                  Surcos Saving (Admin)
                </a>
              </li>
              <li>
                <a href="#ecosistema" className="hover:text-[#0d2922] hover:underline transition-system">
                  AgroRed (Alimentos)
                </a>
              </li>
              <li>
                <a href="#ecosistema" className="hover:text-[#0d2922] hover:underline transition-system">
                  Surcos Fit (Gimnasio)
                </a>
              </li>
              <li>
                <a href="#ecosistema" className="hover:text-[#0d2922] hover:underline transition-system">
                  Surcasino (Recreación)
                </a>
              </li>
            </ul>
          </div>

          {/* Plataforma Col */}
          <div className="space-y-2.5">
            <div className="font-mono-code text-[11px] font-bold text-[#111816] uppercase tracking-wider">
              Plataforma
            </div>
            <ul className="space-y-1.5 text-[12px]">
              <li>
                <a href="#estudiantes" className="hover:text-[#0d2922] hover:underline transition-system">
                  Portal Estudiantil
                </a>
              </li>
              <li>
                <a href="#ledger" className="hover:text-[#0d2922] hover:underline transition-system">
                  General Ledger
                </a>
              </li>
              <li>
                <a href="#ia" className="hover:text-[#0d2922] hover:underline transition-system">
                  IA &amp; pgvector
                </a>
              </li>
              <li>
                <a href="#roadmap" className="hover:text-[#0d2922] hover:underline transition-system">
                  Roadmap
                </a>
              </li>
            </ul>
          </div>

          {/* Legal & Seguridad Col */}
          <div className="space-y-2.5">
            <div className="font-mono-code text-[11px] font-bold text-[#111816] uppercase tracking-wider">
              Seguridad &amp; Normativa
            </div>
            <ul className="space-y-1.5 text-[12px] text-[#66746e]">
              <li>Cumplimiento LOPDP Ecuador</li>
              <li>Defensa en 3 Capas (RLS)</li>
              <li>Tokens CSPRNG 256-bit</li>
              <li>Cero Impuestos (IVA 0%)</li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-6 text-center sm:text-left text-[12px] text-[#66746e]">
          &copy; {new Date().getFullYear()} Unidad Educativa Surcos. Todos los derechos reservados.
        </div>

      </div>
    </footer>
  );
}
