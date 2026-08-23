"use client";

import React from "react";
import { CheckCircle2, Sparkles } from "lucide-react";

interface Phase {
  number: string;
  name: string;
  status: "completed" | "future";
  description: string;
  highlights: string[];
}

const phases: Phase[] = [
  {
    number: "01",
    name: "Foundation & Identidad",
    status: "completed",
    description: "Núcleo de identidad institucional, dominio cerrado @colegiosurcos.edu.ec y tokens criptográficos CSPRNG.",
    highlights: ["Registro institucional seguro", "Invitación criptográfica LOPDP", "Monolito modular desacoplado"],
  },
  {
    number: "02",
    name: "Core Platform & Gobernanza",
    status: "completed",
    description: "Gobernanza por organización (1 ADMIN + USERS con permisos granulares) y portal de autoservicio estudiantil.",
    highlights: ["Portal de autoservicio estudiantil", "Matriz modular de permisos", "Aislamiento estricto de PYMES"],
  },
  {
    number: "03",
    name: "Financial Engine & Ledger",
    status: "completed",
    description: "Libro mayor general de partida doble, cuentas de ahorro en Surcos Saving e idempotencia.",
    highlights: ["Σ Débitos = Σ Créditos exacto", "NUMERIC(12,2) sin coma flotante", "Modelo comercial sin impuestos"],
  },
  {
    number: "04",
    name: "Motor Comercial & PYMES",
    status: "completed",
    description: "Despliegue operativo para AgroRed, Surcos Fit y Surcasino con WAC automático y venta de activos.",
    highlights: ["WAC con bloqueo de concurrencia", "Visitas FREE/PAID en gimnasio", "Alquileres lúdicos por tiempo"],
  },
  {
    number: "05",
    name: "Analytics & IA Gobernada",
    status: "completed",
    description: "Asistente inteligente Gemini contextualizado con RAG vectorial en PostgreSQL (pgvector) bajo RLS.",
    highlights: ["Tools de BD tipadas (Cero SQL)", "Búsqueda semántica de normativas", "Auditoría en tiempo real"],
  },
  {
    number: "06",
    name: "Expansión Enterprise & Campus Conectado",
    status: "future",
    description: "Evolución planificada hacia canales móviles nativos iOS/Android y cobro rápido sin efectivo mediante credencial digital.",
    highlights: ["App móvil institucional iOS & Android", "Control de accesos y pagos con código QR", "Soporte multi-tenancy para red de colegios"],
  },
];

export function Roadmap() {
  return (
    <section id="roadmap" className="py-28 border-t border-black/[0.06] bg-[#fafbfc]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-20 space-y-4">
          <div className="text-[12px] font-mono-code font-medium text-[#2d6a4f] uppercase tracking-wider">
            Evolución &amp; Madurez del Producto
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#111816] font-sans-ui leading-[1.12]">
            Construido sobre bases sólidas,{" "}
            <span className="font-serif-display italic font-normal text-[#0d2922] text-[1.12em] tracking-normal">
              proyectado al futuro
            </span>
            .
          </h2>
          <p className="text-base sm:text-lg text-[#4b5853] leading-relaxed font-sans-ui">
            Conoce el estado de las capacidades operativas de Surcos 360 y la ruta de expansión institucional planificada en el PRD.
          </p>
        </div>

        {/* Linear Phases Timeline Stream */}
        <div className="divide-y divide-black/[0.06] border-t border-b border-black/[0.06]">
          {phases.map((phase) => {
            const isCompleted = phase.status === "completed";
            return (
              <div
                key={phase.number}
                className={`py-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-baseline transition-system ${
                  !isCompleted ? "bg-[#ebf7ee]/30 p-6 -mx-6 rounded-2xl border border-[#badac3]/50 my-4" : ""
                }`}
              >
                {/* Phase Number & Status */}
                <div className="md:col-span-3 flex items-center gap-3">
                  <span className="font-mono-code text-xs font-bold text-[#66746e]">
                    FASE {phase.number}
                  </span>
                  {isCompleted ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono-code text-[#2d6a4f] bg-[#ebf7ee] px-2.5 py-0.5 rounded-full border border-[#badac3]/40">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>En Producción</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono-code text-[#0d2922] bg-[#d8f3dc] px-3 py-1 rounded-full font-bold border border-[#badac3]/60 shadow-sm">
                      <Sparkles className="w-3 h-3 text-[#2d6a4f]" />
                      <span>Próxima Entrega</span>
                    </span>
                  )}
                </div>

                {/* Title & Description */}
                <div className="md:col-span-4 space-y-1">
                  <h3 className="text-base font-bold text-[#111816] font-sans-ui">
                    {phase.name}
                  </h3>
                  <p className="text-[13px] text-[#4b5853] leading-relaxed font-sans-ui">
                    {phase.description}
                  </p>
                </div>

                {/* Highlights */}
                <div className="md:col-span-5 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-[#66746e] font-sans-ui">
                  {phase.highlights.map((h, idx) => (
                    <span key={idx} className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${isCompleted ? "bg-[#2d6a4f]" : "bg-[#0d2922]"}`} />
                      <span className={!isCompleted ? "text-[#0d2922] font-semibold" : "text-[#111816]"}>{h}</span>
                    </span>
                  ))}
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
