"use client";

import React, { useState } from "react";
import { Scale, CheckCircle2 } from "lucide-react";

interface PresetTransaction {
  id: string;
  name: string;
  org: string;
  amount: number;
  debitAccount: string;
  creditAccount: string;
}

const presets: PresetTransaction[] = [
  {
    id: "tx-lunch",
    name: "Almuerzo Saludable (AgroRed)",
    org: "AgroRed",
    amount: 8.50,
    debitAccount: "2101 · Pasivo Ahorro Estudiante",
    creditAccount: "4101 · Ingresos por Ventas AgroRed",
  },
  {
    id: "tx-gym",
    name: "Pase Mensual Gym (Surcos Fit)",
    org: "Surcos Fit",
    amount: 20.00,
    debitAccount: "2101 · Pasivo Ahorro Estudiante",
    creditAccount: "4102 · Ingresos Membresías Surcos Fit",
  },
  {
    id: "tx-game",
    name: "Alquiler Jenga 2h (Surcasino)",
    org: "Surcasino",
    amount: 3.00,
    debitAccount: "2101 · Pasivo Ahorro Estudiante",
    creditAccount: "4103 · Ingresos Alquileres Surcasino",
  },
];

export function LedgerEngine() {
  const [selectedTx, setSelectedTx] = useState<PresetTransaction>(presets[0]);

  return (
    <section id="ledger" className="py-28 border-t border-black/[0.06]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-20 space-y-4">
          <div className="text-[12px] font-mono-code font-medium text-[#2d6a4f] uppercase tracking-wider">
            Motor Financiero &amp; General Ledger
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#111816] font-sans-ui leading-[1.12]">
            Garantía matemática de{" "}
            <span className="font-serif-display italic font-normal text-[#0d2922] text-[1.12em] tracking-normal">
              partida doble
            </span>
            . Cero inconsistencias.
          </h2>
          <p className="text-base sm:text-lg text-[#4b5853] leading-relaxed font-sans-ui">
            Cada movimiento comercial y financiero se asienta con balance exacto entre débitos y créditos (<code className="font-mono-code text-[#0d2922] font-semibold text-sm">Σ Débitos = Σ Créditos</code>), precisión numérica exacta <code className="font-mono-code text-[#0d2922] font-semibold text-sm">NUMERIC(12,2)</code> y registros inmutables de solo inserción.
          </p>
        </div>

        {/* Interactive Balance Demonstrator */}
        <div className="border border-black/[0.08] rounded-3xl p-6 sm:p-10 mb-20 bg-white shadow-sm space-y-8">
          
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-black/[0.06]">
            <div className="flex items-center gap-3">
              <Scale className="w-5 h-5 text-[#2d6a4f]" />
              <span className="font-bold text-lg text-[#111816] font-sans-ui">
                Simulador de Equilibrio Contable en Vivo
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-mono-code text-[#2d6a4f] bg-[#ebf7ee] px-3 py-1 rounded-full border border-[#badac3]/40 flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2d6a4f]" />
                <span>Σ D − Σ C = $0.00 (ACID)</span>
              </span>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="space-y-2">
            <span className="text-[11px] font-mono-code text-[#66746e] uppercase font-semibold">
              Seleccionar Transacción de Prueba:
            </span>
            <div className="flex flex-wrap gap-2 pt-1">
              {presets.map((preset) => {
                const isSelected = selectedTx.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => setSelectedTx(preset)}
                    className={`px-4 py-2 text-[12px] rounded-full transition-system font-medium font-sans-ui cursor-pointer ${
                      isSelected
                        ? "bg-[#0d2922] text-white shadow-sm font-semibold"
                        : "bg-black/[0.04] text-[#4b5853] hover:bg-black/[0.08] hover:text-[#111816]"
                    }`}
                  >
                    <span>{preset.name}</span>
                    <span className="ml-1.5 font-mono-code font-bold tabular-nums">(${preset.amount.toFixed(2)})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Atomic Ledger Entry Table */}
          <div className="font-mono-code text-[13px] bg-[#fafbfc] rounded-2xl p-5 sm:p-6 border border-black/[0.06] space-y-4">
            <div className="grid grid-cols-12 text-[#66746e] text-[11px] font-sans-ui border-b border-black/[0.06] pb-2 font-semibold">
              <div className="col-span-8">CUENTA CONTABLE DEL MAYOR</div>
              <div className="col-span-2 text-right">DÉBITO (+)</div>
              <div className="col-span-2 text-right">CRÉDITO (-)</div>
            </div>

            <div className="grid grid-cols-12 py-1 items-center animate-tab-content">
              <div className="col-span-8 font-sans-ui text-[#111816] font-medium">
                {selectedTx.debitAccount}
              </div>
              <div className="col-span-2 text-right font-bold text-[#111816] tabular-nums">
                +${selectedTx.amount.toFixed(2)}
              </div>
              <div className="col-span-2 text-right text-black/20 tabular-nums">
                $0.00
              </div>
            </div>

            <div className="grid grid-cols-12 py-1 items-center animate-tab-content">
              <div className="col-span-8 font-sans-ui text-[#111816] font-medium">
                {selectedTx.creditAccount}
              </div>
              <div className="col-span-2 text-right text-black/20 tabular-nums">
                $0.00
              </div>
              <div className="col-span-2 text-right font-bold text-[#2d6a4f] tabular-nums">
                +${selectedTx.amount.toFixed(2)}
              </div>
            </div>

            <div className="grid grid-cols-12 pt-3 border-t border-black/[0.08] font-bold text-[14px]">
              <div className="col-span-8 text-[#2d6a4f] font-sans-ui flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Balance Atómico Cuadrado a Cero</span>
              </div>
              <div className="col-span-2 text-right text-[#111816] tabular-nums">
                ${selectedTx.amount.toFixed(2)}
              </div>
              <div className="col-span-2 text-right text-[#2d6a4f] tabular-nums">
                ${selectedTx.amount.toFixed(2)}
              </div>
            </div>
          </div>

        </div>

        {/* 3 Columns: Separation of Heritage (Pure Editorial Grid with Hairlines) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          
          <div className="space-y-3">
            <div className="text-[11px] font-mono-code uppercase text-[#2d6a4f] font-semibold">
              01 · Circulante
            </div>
            <h3 className="text-lg font-bold text-[#111816] font-sans-ui">
              Inventario Comercial (WAC)
            </h3>
            <p className="text-[14px] text-[#4b5853] leading-relaxed font-sans-ui">
              Bienes de consumo regular valorados mediante <strong className="text-[#111816]">Costo Promedio Ponderado</strong> continuo. Bloqueos pesimistas en base de datos aseguran el cálculo del Costo de Ventas (COGS) en cada compra.
            </p>
          </div>

          <div className="space-y-3 md:border-l md:border-black/[0.06] md:pl-8">
            <div className="text-[11px] font-mono-code uppercase text-[#2d6a4f] font-semibold">
              02 · Fijo
            </div>
            <h3 className="text-lg font-bold text-[#111816] font-sans-ui">
              Activos Patrimoniales
            </h3>
            <p className="text-[14px] text-[#4b5853] leading-relaxed font-sans-ui">
              Equipamiento deportivo de Surcos Fit, mobiliario y juegos lúdicos de Surcasino con serial único y custodio asignado. Liquidación o amortización sin alterar el inventario corriente.
            </p>
          </div>

          <div className="space-y-3 md:border-l md:border-black/[0.06] md:pl-8">
            <div className="text-[11px] font-mono-code uppercase text-[#2d6a4f] font-semibold">
              03 · Compromisos
            </div>
            <h3 className="text-lg font-bold text-[#111816] font-sans-ui">
              Pasivos con Proveedores
            </h3>
            <p className="text-[14px] text-[#4b5853] leading-relaxed font-sans-ui">
              Cuentas por pagar e historial comercial estrictamente desacoplados, previniendo la mezcla indebida de fondos de ahorro estudiantil con deudas operativas institucionales.
            </p>
          </div>

        </div>

      </div>
    </section>
  );
}
