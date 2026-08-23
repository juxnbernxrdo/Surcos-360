"use client";

import React from "react";

interface OrganizationItem {
  number: string;
  name: string;
  category: string;
  descriptor: string;
  role: string;
  isCore?: boolean;
}

const orgs: OrganizationItem[] = [
  {
    number: "01",
    name: "Surcos Saving",
    category: "Administración Central",
    descriptor: "Custodia de depósitos estudiantiles, libro mayor general y reportería institucional.",
    role: "Núcleo Financiero",
    isCore: true,
  },
  {
    number: "02",
    name: "AgroRed",
    category: "Alimentación & Cosechas",
    descriptor: "Comercialización de alimentos saludables y cosechas con costeo de ventas continuo.",
    role: "PYME Comercial",
  },
  {
    number: "03",
    name: "Surcos Fit",
    category: "Deporte & Salud",
    descriptor: "Operación del gimnasio escolar, control de aforo en vivo y comercialización de membresías.",
    role: "PYME de Servicios",
  },
  {
    number: "04",
    name: "Surcasino",
    category: "Recreación & Lúdica",
    descriptor: "Alquiler por horas de juegos formativos y material lúdico con auditoría de devolución.",
    role: "PYME de Alquiler",
  },
];

export function EcosystemShowcase() {
  return (
    <section id="ecosistema" className="py-28 sm:py-36 border-t border-black/[0.06]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header: Pure Editorial Typography & Whitespace */}
        <div className="max-w-3xl mb-20 sm:mb-28 space-y-6">
          <div className="inline-flex items-center gap-2 text-[12px] font-mono-code font-medium text-[#2d6a4f] uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2d6a4f]" />
            <span>Estructura Multiorganizacional</span>
          </div>

          <h2 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[#111816] font-sans-ui leading-[1.05] text-balance">
            Cuatro organizaciones.{" "}
            <span className="font-serif-display italic font-normal text-[#0d2922] text-[1.12em] tracking-normal">
              Un solo ecosistema
            </span>
            .
          </h2>

          <p className="text-lg sm:text-xl text-[#4b5853] leading-relaxed font-sans-ui max-w-2xl text-balance">
            Cada organización opera de forma independiente con su propia dinámica comercial, mientras Surcos 360 mantiene la custodia y la visión centralizada de todo el ecosistema.
          </p>
        </div>

        {/* Editorial Composition: Asymmetric Two-Column Architecture */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-20 items-start pb-20 border-b border-black/[0.06]">
          
          {/* Left Column: Core Identity & Institutional Governance Manifesto */}
          <div className="lg:col-span-5 space-y-10 lg:sticky lg:top-28">
            
            <div className="space-y-4">
              <div className="text-[11px] font-mono-code text-[#66746e] uppercase tracking-wider font-semibold">
                Principio Rector de Gobernanza
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-[#111816] font-sans-ui leading-tight">
                Autonomía operativa en el catálogo,{" "}
                <span className="font-serif-display italic font-normal text-[#0d2922]">
                  rigor unificado
                </span>{" "}
                en la contabilidad.
              </h3>
              <p className="text-[14px] sm:text-[15px] text-[#4b5853] leading-relaxed font-sans-ui">
                Surcos 360 desacopla la membresía, inventarios y compras de cada PYME escolar, garantizando que el saldo de ahorro de los estudiantes permanezca protegido en una única entidad de custodia central.
              </p>
            </div>

            {/* Qualitative Tenets (Pure Editorial Narrative, No KPI Numbers) */}
            <div className="pt-6 border-t border-black/[0.06] space-y-6">
              <div className="space-y-1.5">
                <div className="text-[11px] font-mono-code text-[#2d6a4f] uppercase font-semibold">
                  Desacoplamiento Operativo
                </div>
                <h4 className="text-base font-bold text-[#111816] font-sans-ui">
                  Independencia de Catálogo y Precios
                </h4>
                <p className="text-[13px] text-[#4b5853] leading-relaxed font-sans-ui">
                  Cada PYME gestiona sus propios activos, proveedores y políticas comerciales sin interferir en los registros de las demás entidades.
                </p>
              </div>

              <div className="space-y-1.5 pt-2">
                <div className="text-[11px] font-mono-code text-[#2d6a4f] uppercase font-semibold">
                  Custodia Centralizada
                </div>
                <h4 className="text-base font-bold text-[#111816] font-sans-ui">
                  Garantía de Fondos Inmutables
                </h4>
                <p className="text-[13px] text-[#4b5853] leading-relaxed font-sans-ui">
                  Todos los cobros y consumos se concilian en tiempo real dentro del libro mayor de Surcos Saving con respaldo contable absoluto.
                </p>
              </div>
            </div>

          </div>

          {/* Right Column: Pure Typographic Directory */}
          <div className="lg:col-span-7 space-y-2">
            
            <div className="text-[11px] font-mono-code text-[#66746e] uppercase tracking-wider font-semibold pb-4">
              Entidades del Ecosistema Institucional
            </div>

            <div className="divide-y divide-black/[0.08] border-t border-b border-black/[0.08]">
              {orgs.map((org) => (
                <div
                  key={org.number}
                  className="py-8 sm:py-9 space-y-3 group hover:bg-black/[0.01] transition-system select-none px-3 -mx-3 rounded-2xl"
                >
                  {/* Top Row: Number, Role, and Category */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono-code text-xs font-bold text-[#2d6a4f]">
                      {org.number}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono-code text-[#66746e]">
                        {org.role}
                      </span>
                      {org.isCore && (
                        <span className="text-[10px] font-mono-code uppercase font-semibold text-[#2d6a4f] bg-[#ebf7ee] px-2 py-0.5 rounded-full border border-[#badac3]/40">
                          Gobernanza Central
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Name and Category */}
                  <div>
                    <h4 className="text-2xl sm:text-3xl font-bold text-[#111816] font-sans-ui tracking-tight group-hover:text-[#0d2922] transition-system">
                      {org.name}
                    </h4>
                    <div className="text-[13px] font-medium text-[#66746e] font-sans-ui mt-0.5">
                      {org.category}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-[14px] sm:text-[15px] text-[#4b5853] leading-relaxed font-sans-ui max-w-xl">
                    {org.descriptor}
                  </p>
                </div>
              ))}
            </div>

          </div>

        </div>

        {/* Subtle Footer Caption */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-[#66746e] font-sans-ui">
          <div className="font-mono-code text-[11px]">
            Unidad Educativa Surcos · Aislamiento Organizacional Nativo
          </div>
          <div className="flex items-center gap-3 font-mono-code text-[11px]">
            <span>0% IVA Escolar</span>
            <span>·</span>
            <span>Costo Promedio WAC</span>
            <span>·</span>
            <span>Ledger Inmutable</span>
          </div>
        </div>

      </div>
    </section>
  );
}
