"use client";

import React, { useState } from "react";
import { Server, ShieldCheck, Copy, Check } from "lucide-react";

interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  org: string;
  action: string;
  entity: string;
  status: string;
  isLatest?: boolean;
}

const recentAuditLogs: AuditEvent[] = [
  {
    id: "aud-0091",
    timestamp: "17/08/2026 21:45:10",
    actor: "director_fin@colegiosurcos.edu.ec (Authority)",
    org: "Surcos Saving",
    action: "FINANCIAL_REPORT_GENERATED",
    entity: "GeneralLedger::ConsolidatedBalance",
    status: "SUCCESS (200 OK)",
    isLatest: true,
  },
  {
    id: "aud-0090",
    timestamp: "17/08/2026 21:30:04",
    actor: "admin.agrored@colegiosurcos.edu.ec (Admin)",
    org: "AgroRed",
    action: "INVENTORY_WAC_RECALCULATED",
    entity: "InventoryItem::SKU-AGR-01",
    status: "SUCCESS (200 OK)",
  },
  {
    id: "aud-0089",
    timestamp: "17/08/2026 20:12:33",
    actor: "j.perez_est@colegiosurcos.edu.ec (Student)",
    org: "Surcos Saving",
    action: "INVITATION_TOKEN_CREATED",
    entity: "RepresentativeInvitation::SHA256",
    status: "SUCCESS (201 CREATED)",
  },
  {
    id: "aud-0088",
    timestamp: "17/08/2026 19:50:11",
    actor: "external_ip_blocked (Unauthenticated)",
    org: "Core Gateway",
    action: "DIRECT_MUTATION_ATTEMPT",
    entity: "LedgerEntry::UPDATE",
    status: "BLOCKED (403 FORBIDDEN - RLS)",
  },
];

export function SecurityDefense() {
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);

  const copyLogId = (id: string) => {
    navigator.clipboard?.writeText(id);
    setCopiedLogId(id);
    setTimeout(() => setCopiedLogId(null), 1400);
  };

  return (
    <section id="seguridad" className="py-28 border-t border-black/[0.06]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-20 space-y-4">
          <div className="text-[12px] font-mono-code font-medium text-[#2d6a4f] uppercase tracking-wider">
            Defensa en Profundidad &amp; Auditoría
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#111816] font-sans-ui leading-[1.12]">
            Tres capas de seguridad y{" "}
            <span className="font-serif-display italic font-normal text-[#0d2922] text-[1.12em] tracking-normal">
              trazabilidad inmutable
            </span>
            .
          </h2>
          <p className="text-base sm:text-lg text-[#4b5853] leading-relaxed font-sans-ui">
            Ningún nivel de la plataforma asume que el nivel anterior es infalible. Si la validación de la interfaz o de la API fallara, las políticas nativas de base de datos impiden cualquier acceso indebido a los registros contables y datos estudiantiles.
          </p>
        </div>

        {/* Two-Column Asymmetric Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          
          {/* Left Column: 3 Layers of Defense */}
          <div className="lg:col-span-5 space-y-4">
            <div className="text-[11px] uppercase tracking-wider font-mono-code text-[#66746e] font-semibold pb-2 border-b border-black/[0.06]">
              Capas de Control &amp; Aislamiento
            </div>

            <div className="divide-y divide-black/[0.06] border-b border-black/[0.06]">
              
              <div className="py-5 select-none">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-code text-xs font-bold text-[#0d2922]">01</span>
                    <span className="font-bold text-[14px] text-[#111816] font-sans-ui">
                      Capa 1: Frontend UI Guard
                    </span>
                  </div>
                  <span className="text-[11px] font-mono-code text-[#66746e]">Next.js</span>
                </div>
                <p className="text-[13px] text-[#4b5853] pl-6 leading-relaxed font-sans-ui">
                  Ocultamiento y deshabilitación preventiva de acciones no autorizadas según los claims del usuario (ej. portal estudiantil sin controles comerciales).
                </p>
              </div>

              <div className="py-5 select-none">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-code text-xs font-bold text-[#0d2922]">02</span>
                    <span className="font-bold text-[14px] text-[#111816] font-sans-ui">
                      Capa 2: NestJS Guards &amp; Permisos
                    </span>
                  </div>
                  <span className="text-[11px] font-mono-code text-[#66746e]">API Gateway</span>
                </div>
                <p className="text-[13px] text-[#4b5853] pl-6 leading-relaxed font-sans-ui">
                  Evaluación estricta de JWT, validación de membresía (<code className="font-mono-code text-[#111816]">ADMIN / USER</code>) y comprobación de permisos granulares (<code className="font-mono-code text-[#111816]">inventory.*, sales.*</code>) por endpoint.
                </p>
              </div>

              <div className="py-5 select-none">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-code text-xs font-bold text-[#0d2922]">03</span>
                    <span className="font-bold text-[14px] text-[#111816] font-sans-ui">
                      Capa 3: PostgreSQL RLS
                    </span>
                  </div>
                  <span className="text-[11px] font-mono-code text-[#2d6a4f]">Data Layer</span>
                </div>
                <p className="text-[13px] text-[#4b5853] pl-6 leading-relaxed font-sans-ui">
                  Políticas nativas de base de datos a nivel de fila que bloquean intentos maliciosos de bypass de API, garantizando aislamiento estricto de cada organización y estudiante.
                </p>
              </div>

            </div>
          </div>

          {/* Right Column: Real-time Immutable AuditLog Stream */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.06]">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-[#2d6a4f]" />
                <span className="text-[12px] font-mono-code font-bold text-[#111816]">
                  Pista de Auditoría Inmutable (AuditLog)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#2d6a4f] animate-realtime-pulse" />
                <span className="text-[11px] font-mono-code text-[#2d6a4f] bg-[#ebf7ee] px-2.5 py-0.5 rounded-full border border-[#badac3]/40">
                  Append-Only Live
                </span>
              </div>
            </div>

            <div className="divide-y divide-black/[0.04] font-mono-code text-[12px] pt-1">
              {recentAuditLogs.map((log) => (
                <div key={log.id} className="py-3.5 space-y-1 group hover:bg-black/[0.01] transition-system px-2 -mx-2 rounded-lg">
                  <div className="flex items-center justify-between text-[#66746e] text-[11px]">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyLogId(log.id)}
                        className="inline-flex items-center gap-1 hover:text-[#0d2922] transition-system cursor-pointer font-bold underline decoration-black/20"
                        title="Copiar ID de auditoría"
                      >
                        <span>{log.id}</span>
                        {copiedLogId === log.id ? (
                          <Check className="w-3 h-3 text-[#2d6a4f]" />
                        ) : (
                          <Copy className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                        )}
                      </button>
                      <span>·</span>
                      <span className="tabular-nums">{log.timestamp}</span>
                    </div>
                    <span className="text-[#0d2922] font-semibold">{log.org}</span>
                  </div>
                  <div className="text-[#111816] font-semibold">
                    {log.action} · <span className="text-[#4b5853] font-normal">{log.entity}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#66746e] pt-0.5 font-sans-ui">
                    <span className="truncate pr-2">{log.actor}</span>
                    <span className="shrink-0 text-[#2d6a4f] font-mono-code tabular-nums">{log.status}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 flex items-center gap-2 text-[12px] text-[#66746e] font-sans-ui border-t border-black/[0.06]">
              <ShieldCheck className="w-4 h-4 text-[#2d6a4f]" />
              <span>Garantía de no repudio: cada evento registra IP, User-Agent y hash de transacción.</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
