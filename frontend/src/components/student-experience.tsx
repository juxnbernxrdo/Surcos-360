"use client";

import React, { useState } from "react";
import { ShieldCheck, Copy, Check } from "lucide-react";

export function StudentExperience() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 1400);
  };

  const receipts = [
    { name: "AgroRed · Almuerzo Nutritivo + Jugo", date: "15/08/2026 11:30", tx: "TX-00984", amount: "-$8.50", balance: "$75.00", isNegative: true },
    { name: "Surcos Fit · Visita Libre de Gimnasio", date: "14/08/2026 15:10", tx: "VST-00312", amount: "$0.00", balance: "$83.50", isNegative: false, isZero: true },
    { name: "Surcasino · Alquiler Tenis de Mesa (1h)", date: "12/08/2026 10:00", tx: "RNT-00120", amount: "-$3.00", balance: "$83.50", isNegative: true },
    { name: "Surcos Saving · Depósito Inicial Legal", date: "10/08/2026 08:30", tx: "TX-00001", amount: "+$100.00", balance: "$100.00", isNegative: false, isPositive: true },
  ];

  return (
    <section id="estudiantes" className="py-28 border-t border-black/[0.06] bg-[#fafbfc]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-20 space-y-4">
          <div className="text-[12px] font-mono-code font-medium text-[#2d6a4f] uppercase tracking-wider">
            Portal Estudiantil &amp; Autonomía
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#111816] font-sans-ui leading-[1.12]">
            Educación financiera clara.{" "}
            <span className="font-serif-display italic font-normal text-[#0d2922] text-[1.12em] tracking-normal">
              Autonomía y transparencia
            </span>
            .
          </h2>
          <p className="text-base sm:text-lg text-[#4b5853] leading-relaxed font-sans-ui">
            Diseñado para brindar a cada estudiante consulta de saldo en tiempo real, desglose granular de consumos y protección de fondos en tres capas de seguridad independientes.
          </p>
        </div>

        {/* Two-Column Asymmetric Layout (Showcase 2: The Student Portal & Cryptographic Privacy) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          
          {/* Left Column: Product Showcase — Authentic Student Portal Experience */}
          <div className="lg:col-span-7">
            <div className="macos-window bg-white border border-black/[0.08] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.06)]">
              
              {/* Sheet Titlebar */}
              <div className="px-6 py-4 bg-[#fafbfc] border-b border-black/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#0d2922] text-white flex items-center justify-center font-bold text-[11px] font-mono-code">
                    JP
                  </div>
                  <div>
                    <span className="font-bold text-[14px] text-[#111816] font-sans-ui">Juan Pérez</span>
                    <span className="text-[12px] text-[#66746e] pl-2 font-sans-ui">3ro BGU &quot;A&quot; · @colegiosurcos.edu.ec</span>
                  </div>
                </div>

                <span className="text-[11px] font-mono-code text-[#2d6a4f] bg-[#ebf7ee] px-3 py-1 rounded-full border border-[#badac3]/40">
                  Autoservicio Activo
                </span>
              </div>

              {/* Sheet Content */}
              <div className="p-6 sm:p-8 space-y-6">
                
                {/* Balance Triple Metric Bar */}
                <div className="grid grid-cols-3 gap-4 pb-6 border-b border-black/[0.06] font-mono-code">
                  <div>
                    <div className="text-[11px] text-[#66746e] font-sans-ui font-medium">Monto Asignado</div>
                    <div className="text-base sm:text-lg font-semibold text-[#111816] mt-1 tabular-nums">$100.00</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#66746e] font-sans-ui font-medium">Consumos en PYMES</div>
                    <div className="text-base sm:text-lg font-semibold text-[#4b5853] mt-1 tabular-nums">-$25.00</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#2d6a4f] font-sans-ui font-semibold">Saldo Disponible</div>
                    <div className="text-xl sm:text-2xl font-bold text-[#0d2922] mt-0.5 tabular-nums">$75.00</div>
                  </div>
                </div>

                {/* Granular Activity Stream */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-[#66746e] font-mono-code font-semibold">
                    <span>Historial de Comprobantes Individuales</span>
                    <span>Modo Solo Lectura</span>
                  </div>

                  <div className="divide-y divide-black/[0.04] border-t border-b border-black/[0.06] font-mono-code text-[12px]">
                    {receipts.map((r) => (
                      <div key={r.tx} className="py-3 flex items-center justify-between group hover:bg-black/[0.01] transition-system px-1 -mx-1 rounded-lg">
                        <div>
                          <div className={`font-sans-ui font-medium ${r.isPositive ? "text-[#2d6a4f]" : "text-[#111816]"}`}>{r.name}</div>
                          <div className="text-[11px] text-[#66746e] flex items-center gap-1.5 pt-0.5">
                            <span>{r.date}</span>
                            <span>·</span>
                            <button
                              onClick={() => copyToClipboard(r.tx)}
                              className="inline-flex items-center gap-1 hover:text-[#0d2922] transition-system cursor-pointer font-semibold underline decoration-black/20 hover:decoration-black"
                              title="Copiar ID de transacción"
                            >
                              <span>{r.tx}</span>
                              {copiedId === r.tx ? (
                                <Check className="w-3 h-3 text-[#2d6a4f]" />
                              ) : (
                                <Copy className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                              )}
                            </button>
                            {copiedId === r.tx && (
                              <span className="text-[10px] text-[#2d6a4f] font-sans-ui font-semibold bg-[#ebf7ee] px-1.5 py-0.2 rounded">
                                Copiado
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold tabular-nums ${r.isZero || r.isPositive ? "text-[#2d6a4f]" : "text-[#111816]"}`}>
                            {r.amount}
                          </div>
                          <div className="text-[10px] text-[#66746e] tabular-nums">Saldo: {r.balance}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3-Layer Security Callout */}
                <div className="flex items-start gap-3 text-[12px] text-[#4b5853] pt-1 font-sans-ui">
                  <ShieldCheck className="w-4 h-4 text-[#2d6a4f] shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong className="text-[#111816]">Aislamiento Estudiantil en 3 Capas:</strong> La interfaz no presenta opciones de mutación comercial, la API rechaza peticiones de escritura y PostgreSQL RLS garantiza aislamiento estricto por cuenta.
                  </p>
                </div>

              </div>

            </div>
          </div>

          {/* Right Column: Cryptographic Parent Invitation Flow */}
          <div className="lg:col-span-5 space-y-7">
            
            <div className="space-y-3">
              <span className="text-[11px] font-mono-code text-[#2d6a4f] font-semibold uppercase tracking-wider">
                Protección de Datos &amp; LOPDP Ecuador
              </span>
              <h3 className="text-2xl sm:text-3xl font-bold text-[#111816] tracking-tight font-sans-ui leading-tight">
                Vinculación Criptográfica de{" "}
                <span className="font-serif-display italic font-normal text-[#0d2922] text-[1.12em] tracking-normal">
                  Representantes
                </span>
              </h3>
              <p className="text-[14px] sm:text-[15px] text-[#4b5853] leading-relaxed font-sans-ui">
                Los padres de familia no requieren correo institucional `@colegiosurcos.edu.ec`. Para proteger los datos del menor, se integran mediante tokens seguros generados exclusivamente por su representado:
              </p>
            </div>

            {/* Editorial Sequence */}
            <div className="divide-y divide-black/[0.06] border-t border-b border-black/[0.06]">
              
              <div className="py-5 select-none">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono-code text-xs font-bold text-[#0d2922]">01</span>
                    <span className="font-bold text-[14px] text-[#111816] font-sans-ui">
                      Token CSPRNG de 256 bits
                    </span>
                  </div>
                  <span className="text-[11px] font-mono-code text-[#66746e]">SHA-256</span>
                </div>
                <p className="text-[13px] text-[#4b5853] pl-6 leading-relaxed font-sans-ui">
                  El estudiante genera el enlace desde su portal. En base de datos únicamente se almacena el hash criptográfico; el token en plano jamás se persiste.
                </p>
              </div>

              <div className="py-5 select-none">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono-code text-xs font-bold text-[#0d2922]">02</span>
                    <span className="font-bold text-[14px] text-[#111816] font-sans-ui">
                      Uso Único y Caducidad
                    </span>
                  </div>
                  <span className="text-[11px] font-mono-code text-[#66746e]">maxUses = 1</span>
                </div>
                <p className="text-[13px] text-[#4b5853] pl-6 leading-relaxed font-sans-ui">
                  El enlace expira a las 48 horas. Una vez canjeado, el estado cambia a USED de forma atómica, imposibilitando cualquier reutilización.
                </p>
              </div>

              <div className="py-5 select-none">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono-code text-xs font-bold text-[#0d2922]">03</span>
                    <span className="font-bold text-[14px] text-[#111816] font-sans-ui">
                      Aislamiento Estricto de Vínculo
                    </span>
                  </div>
                  <span className="text-[11px] font-mono-code text-[#2d6a4f]">Zero Cross-Link</span>
                </div>
                <p className="text-[13px] text-[#4b5853] pl-6 leading-relaxed font-sans-ui">
                  El representante se registra con su correo personal (Gmail, Outlook, etc.) quedando exclusivamente vinculado al estudiante emisor bajo la LOPDP.
                </p>
              </div>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
