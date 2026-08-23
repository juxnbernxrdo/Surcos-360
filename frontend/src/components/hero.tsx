"use client";

import React, { useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";

interface HeroProps {
  onOpenDemo?: () => void;
}

export function Hero({ onOpenDemo }: HeroProps) {
  const [activeFlowStep, setActiveFlowStep] = useState<number>(1);

  return (
    <section className="relative pt-32 pb-24 md:pt-44 md:pb-32 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Editorial Hero Layout */}
        <div className="max-w-4xl mx-auto text-center space-y-8 mb-16 sm:mb-20">
          
          {/* 1. Staged Entrance: Majestic Headline with Instrument Serif */}
          <h1 className="animate-hero-1 text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[#111816] leading-[1.08] text-balance font-sans-ui">
            La plataforma central para la{" "}
            <span className="font-serif-display italic font-normal text-[#0d2922] text-[1.14em] tracking-normal">
              educación
            </span>
            , las finanzas y el{" "}
            <span className="font-serif-display italic font-normal text-[#0d2922] text-[1.14em] tracking-normal">
              ecosistema
            </span>{" "}
            Surcos.
          </h1>

          {/* 2. Staged Entrance: Supporting Copy */}
          <p className="animate-hero-2 text-base sm:text-xl text-[#4b5853] leading-relaxed max-w-2xl mx-auto font-normal font-sans-ui text-balance">
            Unifica el fondo de ahorro estudiantil, cuatro organizaciones operativas escolares y la contabilidad inmutable de partida doble en una experiencia de sistema moderna.
          </p>

          {/* 3. Staged Entrance: CTAs */}
          <div className="animate-hero-3 flex flex-wrap items-center justify-center gap-3.5 pt-2">
            <a
              href="#ecosistema"
              className="px-6 py-3 rounded-full font-medium text-[13px] text-white bg-[#0d2922] hover:bg-[#153b32] active:scale-[0.985] transition-system shadow-sm flex items-center gap-2 font-sans-ui focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6a4f]"
            >
              <span>Explorar el Ecosistema</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={onOpenDemo}
              className="px-6 py-3 rounded-full font-medium text-[13px] text-[#111816] bg-white hover:bg-[#f6f7f6] active:scale-[0.985] border border-black/[0.09] transition-system shadow-sm font-sans-ui cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6a4f]"
            >
              Ver Demostración
            </button>
          </div>

        </div>

        {/* Product Showcase 1 — The Unified Transaction Flow */}
        <div className="animate-hero-4 max-w-4xl mx-auto">
          
          {/* Main Showcase Surface */}
          <div className="macos-window bg-white border border-black/[0.08] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.06)]">
            
            {/* Window Header */}
            <div className="px-6 py-4 bg-[#fafbfc] border-b border-black/[0.06] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]/30" />
                  <span className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]/30" />
                  <span className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]/30" />
                </div>
                <span className="text-[12px] text-[#66746e] font-mono-code font-medium pl-1 hidden sm:inline">
                  surcos360.colegiosurcos.edu.ec
                </span>
              </div>

              {/* Segmented Flow Navigation with Physical Pill Indicator */}
              <div className="segmented-control p-1 relative" role="tablist" aria-label="Flujo de transacción">
                <button
                  role="tab"
                  aria-selected={activeFlowStep === 1}
                  onClick={() => setActiveFlowStep(1)}
                  className={`relative z-10 px-3 py-1 text-[11px] font-medium rounded-full transition-system font-sans-ui cursor-pointer ${
                    activeFlowStep === 1
                      ? "text-[#111816] font-semibold"
                      : "text-[#66746e] hover:text-[#111816]"
                  }`}
                >
                  1. Ahorro Estudiantil
                </button>
                <button
                  role="tab"
                  aria-selected={activeFlowStep === 2}
                  onClick={() => setActiveFlowStep(2)}
                  className={`relative z-10 px-3 py-1 text-[11px] font-medium rounded-full transition-system font-sans-ui cursor-pointer ${
                    activeFlowStep === 2
                      ? "text-[#111816] font-semibold"
                      : "text-[#66746e] hover:text-[#111816]"
                  }`}
                >
                  2. Consumo en PYME
                </button>
                <button
                  role="tab"
                  aria-selected={activeFlowStep === 3}
                  onClick={() => setActiveFlowStep(3)}
                  className={`relative z-10 px-3 py-1 text-[11px] font-medium rounded-full transition-system font-sans-ui cursor-pointer ${
                    activeFlowStep === 3
                      ? "text-[#111816] font-semibold"
                      : "text-[#66746e] hover:text-[#111816]"
                  }`}
                >
                  3. Asiento Inmutable
                </button>

                {/* Smooth Animated Sliding Indicator */}
                <div
                  className="absolute top-1 bottom-1 bg-white rounded-full shadow-sm transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] pointer-events-none"
                  style={{
                    left: activeFlowStep === 1 ? "4px" : activeFlowStep === 2 ? "34.5%" : "68%",
                    width: activeFlowStep === 1 ? "32%" : activeFlowStep === 2 ? "32.5%" : "30.5%",
                  }}
                />
              </div>
            </div>

            {/* Interactive Showcase Narrative Content with Cross-fade Transition */}
            <div className="p-6 sm:p-10 space-y-6">
              
              {/* Step 1: Student Deposit Custody */}
              {activeFlowStep === 1 && (
                <div key="step-1" className="space-y-5 animate-tab-content">
                  <div className="flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b border-black/[0.06]">
                    <div>
                      <span className="text-[11px] font-mono-code text-[#2d6a4f] uppercase tracking-wider font-semibold">
                        Fondo Custodiado en Surcos Saving
                      </span>
                      <h3 className="text-xl font-bold text-[#111816] font-sans-ui mt-0.5">
                        Cuenta Estudiantil · Juan Pérez (3ro BGU)
                      </h3>
                    </div>
                    <div className="text-right font-mono-code">
                      <div className="text-[11px] text-[#66746e] font-sans-ui">Saldo en Custodia</div>
                      <div className="text-2xl font-bold text-[#0d2922] tabular-nums">$75.00</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 font-mono-code text-[13px] pt-1">
                    <div>
                      <span className="text-[11px] text-[#66746e] font-sans-ui">Fondo Inicial Asignado:</span>
                      <div className="font-semibold text-[#111816] text-base mt-0.5 tabular-nums">$100.00</div>
                    </div>
                    <div>
                      <span className="text-[11px] text-[#66746e] font-sans-ui">Consumos Acumulados:</span>
                      <div className="font-semibold text-[#4b5853] text-base mt-0.5 tabular-nums">-$25.00</div>
                    </div>
                    <div>
                      <span className="text-[11px] text-[#2d6a4f] font-sans-ui font-semibold">Garantía Inmutable:</span>
                      <div className="font-semibold text-[#0d2922] text-base mt-0.5">100% Conciliado</div>
                    </div>
                  </div>

                  <p className="text-[13px] text-[#4b5853] leading-relaxed font-sans-ui pt-1">
                    Los fondos depositados por el representante legal son custodiados de forma centralizada por <strong className="text-[#111816]">Surcos Saving</strong>. El estudiante accede mediante un portal de autoservicio para supervisar su saldo y comprobantes en tiempo real.
                  </p>
                </div>
              )}

              {/* Step 2: Commercial Transaction at School PYME */}
              {activeFlowStep === 2 && (
                <div key="step-2" className="space-y-5 animate-tab-content">
                  <div className="flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b border-black/[0.06]">
                    <div>
                      <span className="text-[11px] font-mono-code text-[#2d6a4f] uppercase tracking-wider font-semibold">
                        Operación Comercial en PYME
                      </span>
                      <h3 className="text-xl font-bold text-[#111816] font-sans-ui mt-0.5">
                        AgroRed · Venta Mostrador (Almuerzo + Jugo)
                      </h3>
                    </div>
                    <div className="text-right font-mono-code">
                      <div className="text-[11px] text-[#66746e] font-sans-ui">Monto de Venta (0% IVA)</div>
                      <div className="text-2xl font-bold text-[#111816] tabular-nums">$8.50</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 font-mono-code text-[13px] pt-1">
                    <div>
                      <span className="text-[11px] text-[#66746e] font-sans-ui">Costo WAC Unitario:</span>
                      <div className="font-semibold text-[#111816] text-base mt-0.5 tabular-nums">$4.20</div>
                    </div>
                    <div>
                      <span className="text-[11px] text-[#66746e] font-sans-ui">Margen Bruto PYME:</span>
                      <div className="font-semibold text-[#2d6a4f] text-base mt-0.5 tabular-nums">+$4.30 (+50.5%)</div>
                    </div>
                    <div>
                      <span className="text-[11px] text-[#66746e] font-sans-ui">Bloqueo de Stock:</span>
                      <div className="font-semibold text-[#0d2922] text-base mt-0.5">Pessimistic Lock OK</div>
                    </div>
                  </div>

                  <p className="text-[13px] text-[#4b5853] leading-relaxed font-sans-ui pt-1">
                    Al realizar una compra en AgroRed, Surcos Fit o Surcasino, el backend verifica el saldo con bloqueo pesimista en base de datos, descuenta el stock y actualiza automáticamente el Costo Promedio Ponderado (WAC).
                  </p>
                </div>
              )}

              {/* Step 3: Double-Entry Atomic Ledger Entry */}
              {activeFlowStep === 3 && (
                <div key="step-3" className="space-y-5 animate-tab-content">
                  <div className="flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b border-black/[0.06]">
                    <div>
                      <span className="text-[11px] font-mono-code text-[#2d6a4f] uppercase tracking-wider font-semibold">
                        Asiento Contable Mayor · Double-Entry
                      </span>
                      <h3 className="text-xl font-bold text-[#111816] font-sans-ui mt-0.5">
                        Transacción Atómica #TX-00984
                      </h3>
                    </div>
                    <span className="text-[11px] font-mono-code text-[#2d6a4f] bg-[#ebf7ee] px-3 py-1 rounded-full border border-[#badac3]/40">
                      Σ Débitos = Σ Créditos ($8.50)
                    </span>
                  </div>

                  <div className="font-mono-code text-[12px] space-y-2 pt-1">
                    <div className="flex justify-between py-2 border-b border-black/[0.04]">
                      <div>
                        <span className="font-semibold text-[#111816]">2101 · Pasivo Ahorro Estudiante</span>
                        <div className="text-[11px] text-[#66746e] font-sans-ui">Disminución de pasivo por consumo (Débito)</div>
                      </div>
                      <span className="font-bold text-[#111816] text-sm tabular-nums">+$8.50</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-black/[0.04]">
                      <div>
                        <span className="font-semibold text-[#111816]">4101 · Ingresos por Ventas AgroRed</span>
                        <div className="text-[11px] text-[#66746e] font-sans-ui">Reconocimiento de ingreso en PYME (Crédito)</div>
                      </div>
                      <span className="font-bold text-[#2d6a4f] text-sm tabular-nums">+$8.50</span>
                    </div>
                  </div>

                  <p className="text-[13px] text-[#4b5853] leading-relaxed font-sans-ui pt-1">
                    Garantía matemática absoluta: el saldo de débito y crédito cuadra a cero con precisión <code className="font-mono-code text-[#0d2922]">NUMERIC(12,2)</code> en un commit ACID atómico.
                  </p>
                </div>
              )}

              {/* Showcase Footer Strip */}
              <div className="pt-4 border-t border-black/[0.06] flex flex-wrap items-center justify-between gap-3 text-[12px] text-[#66746e] font-sans-ui">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#2d6a4f]" />
                  <span>Idempotencia garantizada por clave única de transacción</span>
                </span>

                <button
                  onClick={onOpenDemo}
                  className="text-[#0d2922] hover:text-[#2d6a4f] font-semibold transition-system flex items-center gap-1.5 group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6a4f] rounded-full px-2 py-0.5"
                >
                  <span>Explorar todas las vistas del sistema</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-system" />
                </button>
              </div>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
