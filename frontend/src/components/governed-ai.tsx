"use client";

import React from "react";
import { Sparkles } from "lucide-react";

export function GovernedAI() {
  return (
    <section id="ia" className="py-28 border-t border-black/[0.06] bg-[#fafbfc]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-20 space-y-4">
          <div className="text-[12px] font-mono-code font-medium text-[#2d6a4f] uppercase tracking-wider">
            Inteligencia Artificial Contextualizada &amp; RAG
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#111816] font-sans-ui leading-[1.12]">
            Analítica gobernada bajo{" "}
            <span className="font-serif-display italic font-normal text-[#0d2922] text-[1.12em] tracking-normal">
              estrictas políticas
            </span>{" "}
            de base de datos.
          </h2>
          <p className="text-base sm:text-lg text-[#4b5853] leading-relaxed font-sans-ui">
            Surcos 360 integra Gemini con búsqueda vectorial semántica (<code className="font-mono-code text-[#0d2922] font-semibold text-sm">pgvector</code>). Toda consulta opera bajo las políticas de Row Level Security (RLS) del usuario autenticado, prohibiendo la ejecución de SQL dinámico libre.
          </p>
        </div>

        {/* Zero-Trust AI Execution Stream (Pure Editorial Flow, No Card Shells) */}
        <div className="border-t border-b border-black/[0.08] py-12 mb-20 space-y-10">
          
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-[13px] font-mono-code text-[#2d6a4f] font-semibold">
              <Sparkles className="w-4 h-4" />
              <span>Cadena de Ejecución Zero-Trust (Gemini 1.5 Pro + pgvector)</span>
            </div>
            <span className="text-[12px] font-mono-code text-[#78857f]">
              Prohibición Absoluta de SQL Libre
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            
            <div className="space-y-3">
              <div className="font-mono-code text-xs font-bold text-[#0d2922] flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#0d2922] text-white flex items-center justify-center text-[10px]">
                  1
                </span>
                <span>CLAIMS JWT</span>
              </div>
              <h3 className="font-bold text-base text-[#111816] font-sans-ui">Identidad Autenticada</h3>
              <p className="text-[13px] text-[#4b5853] leading-relaxed font-sans-ui">
                La solicitud hereda el contexto de seguridad del usuario activo. Jamás se ejecutan llamadas con privilegios elevados <code className="font-mono-code text-[#111816]">service_role</code>.
              </p>
            </div>

            <div className="space-y-3 md:border-l md:border-black/[0.06] md:pl-6">
              <div className="font-mono-code text-xs font-bold text-[#0d2922] flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#0d2922] text-white flex items-center justify-center text-[10px]">
                  2
                </span>
                <span>TOOLS TIPADAS</span>
              </div>
              <h3 className="font-bold text-base text-[#111816] font-sans-ui">Esquema Determinístico</h3>
              <p className="text-[13px] text-[#4b5853] leading-relaxed font-sans-ui">
                El modelo invoca únicamente endpoints y funciones predefinidas en NestJS con validación de parámetros, previniendo cualquier inyección de prompt.
              </p>
            </div>

            <div className="space-y-3 md:border-l md:border-black/[0.06] md:pl-6">
              <div className="font-mono-code text-xs font-bold text-[#0d2922] flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#0d2922] text-white flex items-center justify-center text-[10px]">
                  3
                </span>
                <span>FILTRADO RLS</span>
              </div>
              <h3 className="font-bold text-base text-[#111816] font-sans-ui">PostgreSQL Native RLS</h3>
              <p className="text-[13px] text-[#4b5853] leading-relaxed font-sans-ui">
                Las políticas a nivel de fila aíslan los datos de cada estudiante y PYME en PostgreSQL antes de que el motor sintetice la respuesta semántica.
              </p>
            </div>

            <div className="space-y-3 md:border-l md:border-black/[0.06] md:pl-6">
              <div className="font-mono-code text-xs font-bold text-[#0d2922] flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#0d2922] text-white flex items-center justify-center text-[10px]">
                  4
                </span>
                <span>AUDITLOG</span>
              </div>
              <h3 className="font-bold text-base text-[#111816] font-sans-ui">Pista Inmutable</h3>
              <p className="text-[13px] text-[#4b5853] leading-relaxed font-sans-ui">
                Cada consulta, tool ejecutada y consumo de tokens se registra de forma inmutable para auditoría y cumplimiento del marco LOPDP Ecuador.
              </p>
            </div>

          </div>
        </div>

        {/* 4 Pillars Clean Typographic Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          
          <div className="space-y-2">
            <span className="text-[11px] font-mono-code text-[#2d6a4f] font-semibold uppercase">Privacidad</span>
            <h3 className="text-base font-bold text-[#111816] font-sans-ui">Aislamiento por Rol</h3>
            <p className="text-[13px] text-[#4b5853] leading-relaxed font-sans-ui">
              Un estudiante jamás puede consultar datos consolidados de PYMES ni registros de otros compañeros.
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-mono-code text-[#2d6a4f] font-semibold uppercase">Control</span>
            <h3 className="text-base font-bold text-[#111816] font-sans-ui">Cero SQL Libre</h3>
            <p className="text-[13px] text-[#4b5853] leading-relaxed font-sans-ui">
              Prohibición total de generación o ejecución de queries SQL directos desde el Large Language Model.
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-mono-code text-[#2d6a4f] font-semibold uppercase">Semántica</span>
            <h3 className="text-base font-bold text-[#111816] font-sans-ui">Indexación pgvector</h3>
            <p className="text-[13px] text-[#4b5853] leading-relaxed font-sans-ui">
              Reglamentos escolares, manuales operativos y políticas institucionales vectorizadas para respuestas con contexto.
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-mono-code text-[#2d6a4f] font-semibold uppercase">Trazabilidad</span>
            <h3 className="text-base font-bold text-[#111816] font-sans-ui">Auditoría Append-Only</h3>
            <p className="text-[13px] text-[#4b5853] leading-relaxed font-sans-ui">
              Supervisión de cada token consumido y respuesta emitida bajo cumplimiento del marco LOPDP de Ecuador.
            </p>
          </div>

        </div>

      </div>
    </section>
  );
}
