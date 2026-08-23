"use client";

import React, { useState, useEffect } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InteractivePreviewModal({ isOpen, onClose }: ModalProps) {
  const [activeTab, setActiveTab] = useState<"student" | "ledger" | "pyme" | "ai">("student");
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
    } else if (shouldRender) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, 140);
      return () => clearTimeout(timer);
    }
  }, [isOpen, shouldRender]);

  const handleClose = React.useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 140);
  }, [onClose]);

  // Escape key listener for accessible modal closing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isClosing) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isClosing, handleClose]);

  if (!shouldRender) return null;

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-md ${
        isClosing ? "animate-modal-backdrop-out" : "animate-modal-backdrop-in"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div 
        className={`macos-window bg-white border border-black/[0.1] w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] rounded-3xl overflow-hidden ${
          isClosing ? "animate-modal-content-out" : "animate-modal-content-in"
        }`}
      >
        
        {/* Modal macOS Titlebar */}
        <div className="bg-[#fafbfc] px-6 py-4 border-b border-black/[0.06] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <button 
                onClick={handleClose}
                aria-label="Cerrar ventana"
                className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]/30 flex items-center justify-center hover:opacity-80 transition-system cursor-pointer"
              />
              <span className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]/30" />
              <span className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]/30" />
            </div>
            <h2 id="modal-title" className="font-bold text-[#111816] text-[13px] font-sans-ui">
              Surcos 360 · Demostración del Sistema
            </h2>
          </div>

          {/* Segmented Control Pills with Sliding Indicator */}
          <div className="segmented-control p-1 relative" role="tablist" aria-label="Secciones de demostración">
            <button
              role="tab"
              aria-selected={activeTab === "student"}
              onClick={() => setActiveTab("student")}
              className={`relative z-10 px-3 py-1 text-[11px] font-medium rounded-full transition-system font-sans-ui cursor-pointer ${
                activeTab === "student"
                  ? "text-[#111816] font-semibold"
                  : "text-[#66746e] hover:text-[#111816]"
              }`}
            >
              1. Estudiante
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "ledger"}
              onClick={() => setActiveTab("ledger")}
              className={`relative z-10 px-3 py-1 text-[11px] font-medium rounded-full transition-system font-sans-ui cursor-pointer ${
                activeTab === "ledger"
                  ? "text-[#111816] font-semibold"
                  : "text-[#66746e] hover:text-[#111816]"
              }`}
            >
              2. General Ledger
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "pyme"}
              onClick={() => setActiveTab("pyme")}
              className={`relative z-10 px-3 py-1 text-[11px] font-medium rounded-full transition-system font-sans-ui cursor-pointer ${
                activeTab === "pyme"
                  ? "text-[#111816] font-semibold"
                  : "text-[#66746e] hover:text-[#111816]"
              }`}
            >
              3. PYME AgroRed
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "ai"}
              onClick={() => setActiveTab("ai")}
              className={`relative z-10 px-3 py-1 text-[11px] font-medium rounded-full transition-system font-sans-ui cursor-pointer ${
                activeTab === "ai"
                  ? "text-[#111816] font-semibold"
                  : "text-[#66746e] hover:text-[#111816]"
              }`}
            >
              4. IA Gobernada
            </button>

            {/* Sliding Tab Pill */}
            <div
              className="absolute top-1 bottom-1 bg-white rounded-full shadow-sm transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] pointer-events-none"
              style={{
                left: activeTab === "student" ? "4px" : activeTab === "ledger" ? "25%" : activeTab === "pyme" ? "52%" : "75.5%",
                width: activeTab === "student" ? "24%" : activeTab === "ledger" ? "26%" : activeTab === "pyme" ? "23%" : "23%",
              }}
            />
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-[#111816] text-[13px] font-sans-ui min-h-[300px]">
          
          {/* TAB 1: STUDENT */}
          {activeTab === "student" && (
            <div key="modal-tab-1" className="space-y-5 animate-tab-content">
              <div className="flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b border-black/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#0d2922] text-white flex items-center justify-center font-bold text-xs font-mono-code">
                    JP
                  </div>
                  <div>
                    <div className="font-bold text-base text-[#111816]">Juan Pérez · 3ro BGU &quot;A&quot;</div>
                    <div className="text-[12px] text-[#66746e]">j.perez_est@colegiosurcos.edu.ec</div>
                  </div>
                </div>
                <div className="text-right font-mono-code">
                  <div className="text-[11px] text-[#2d6a4f] font-sans-ui font-semibold">Saldo Disponible</div>
                  <div className="text-xl font-bold text-[#0d2922] tabular-nums">$75.00</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pb-4 border-b border-black/[0.06] font-mono-code text-[12px]">
                <div>
                  <span className="text-[#66746e] font-sans-ui">Fondo Inicial:</span>
                  <div className="font-semibold text-[#111816] mt-0.5 tabular-nums">$100.00</div>
                </div>
                <div>
                  <span className="text-[#66746e] font-sans-ui">Consumos Totales:</span>
                  <div className="font-semibold text-[#4b5853] mt-0.5 tabular-nums">-$25.00</div>
                </div>
                <div>
                  <span className="text-[#2d6a4f] font-sans-ui font-medium">Conciliación:</span>
                  <div className="font-bold text-[#0d2922] mt-0.5">100% Inmutable</div>
                </div>
              </div>

              <div className="space-y-2 font-mono-code text-[12px]">
                <div className="text-[11px] font-sans-ui font-semibold text-[#66746e] uppercase tracking-wider">
                  Comprobantes Granulares en Tiempo Real
                </div>
                <div className="divide-y divide-black/[0.04] border-t border-b border-black/[0.06]">
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="font-sans-ui font-medium">15/08 · AgroRed · Almuerzo Nutritivo + Jugo</span>
                    <span className="font-bold text-[#111816] tabular-nums">-$8.50 (TX-00984)</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="font-sans-ui font-medium">14/08 · Surcos Fit · Visita Libre Gym</span>
                    <span className="font-bold text-[#2d6a4f] tabular-nums">$0.00 (VST-00312)</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="font-sans-ui font-medium">12/08 · Surcasino · Alquiler Jenga (1h)</span>
                    <span className="font-bold text-[#111816] tabular-nums">-$3.00 (RNT-00120)</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="font-sans-ui font-medium text-[#2d6a4f]">10/08 · Surcos Saving · Fondo Inicial</span>
                    <span className="font-bold text-[#2d6a4f] tabular-nums">+$100.00 (TX-00001)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LEDGER */}
          {activeTab === "ledger" && (
            <div key="modal-tab-2" className="space-y-5 animate-tab-content">
              <div className="flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b border-black/[0.06]">
                <div>
                  <span className="text-[11px] font-mono-code text-[#66746e]">Asiento Contable Inmutable #TX-00984</span>
                  <div className="font-bold text-base text-[#111816]">Venta AgroRed a Cuenta Estudiantil</div>
                </div>
                <span className="text-[11px] font-mono-code text-[#2d6a4f] bg-[#ebf7ee] px-3 py-1 rounded-full border border-[#badac3]/40">
                  Σ D = Σ C ($8.50)
                </span>
              </div>

              <div className="font-mono-code text-[12px] space-y-2">
                <div className="grid grid-cols-12 text-[#66746e] pb-1 text-[11px] font-sans-ui border-b border-black/[0.06] font-semibold">
                  <div className="col-span-8">CUENTA MAYOR GENERAL</div>
                  <div className="col-span-2 text-right">DÉBITO (+)</div>
                  <div className="col-span-2 text-right">CRÉDITO (-)</div>
                </div>

                <div className="grid grid-cols-12 py-1.5">
                  <div className="col-span-8 font-sans-ui">2101 · Pasivo Ahorro Estudiante (Juan Pérez)</div>
                  <div className="col-span-2 text-right font-bold text-[#111816] tabular-nums">$8.50</div>
                  <div className="col-span-2 text-right text-black/20 tabular-nums">$0.00</div>
                </div>

                <div className="grid grid-cols-12 py-1.5">
                  <div className="col-span-8 font-sans-ui">4101 · Ingresos por Ventas AgroRed</div>
                  <div className="col-span-2 text-right text-black/20 tabular-nums">$0.00</div>
                  <div className="col-span-2 text-right font-bold text-[#2d6a4f] tabular-nums">$8.50</div>
                </div>

                <div className="grid grid-cols-12 pt-3 border-t border-black/[0.08] font-bold text-[13px]">
                  <div className="col-span-8 text-[#2d6a4f] font-sans-ui">Balance Atómico Verificado (ACID)</div>
                  <div className="col-span-2 text-right text-[#111816] tabular-nums">$8.50</div>
                  <div className="col-span-2 text-right text-[#2d6a4f] tabular-nums">$8.50</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: POS */}
          {activeTab === "pyme" && (
            <div key="modal-tab-3" className="space-y-5 animate-tab-content">
              <div className="flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b border-black/[0.06]">
                <div>
                  <span className="text-[11px] font-mono-code text-[#66746e]">PYME AgroRed · Catálogo &amp; Costeo</span>
                  <div className="font-bold text-base text-[#111816]">Almuerzo Saludable (SKU: AGR-ALM-01)</div>
                </div>
                <span className="text-[11px] font-mono-code text-[#0d2922] bg-black/[0.04] px-3 py-1 rounded-full">
                  0% IVA Escolar
                </span>
              </div>

              <div className="grid grid-cols-2 gap-6 font-mono-code text-[13px] pt-1">
                <div>
                  <span className="text-[#66746e] font-sans-ui text-[12px]">Costo Promedio (WAC):</span>
                  <div className="text-lg font-bold text-[#111816] mt-0.5 tabular-nums">$4.20 / unidad</div>
                </div>
                <div>
                  <span className="text-[#66746e] font-sans-ui text-[12px]">Precio Venta Final:</span>
                  <div className="text-lg font-bold text-[#0d2922] mt-0.5 tabular-nums">$8.50 (IVA 0%)</div>
                </div>
              </div>

              <div className="p-4 bg-[#ebf7ee] text-[#0d2922] rounded-2xl font-mono-code text-[13px] flex justify-between items-center border border-[#badac3]/40">
                <span className="font-sans-ui font-medium">Margen Bruto de Contribución:</span>
                <span className="font-bold tabular-nums">+$4.30 (+50.5%)</span>
              </div>
            </div>
          )}

          {/* TAB 4: AI */}
          {activeTab === "ai" && (
            <div key="modal-tab-4" className="space-y-5 animate-tab-content">
              <div className="flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b border-black/[0.06]">
                <div>
                  <span className="text-[11px] font-mono-code text-[#66746e]">Gemini 1.5 Pro + pgvector</span>
                  <div className="font-bold text-base text-[#111816]">Consulta con Aislamiento Nativo RLS</div>
                </div>
                <span className="text-[11px] font-mono-code text-[#2d6a4f] bg-[#ebf7ee] px-3 py-1 rounded-full border border-[#badac3]/40">
                  Zero-Trust Tools
                </span>
              </div>

              <div className="p-4 bg-[#fafbfc] rounded-2xl border border-black/[0.06] font-mono-code text-[12px] space-y-1">
                <span className="text-[10px] text-[#66746e] uppercase font-sans-ui font-semibold">TOOL INVOCADA DETERMINÍSTICAMENTE:</span>
                <div className="text-[#0d2922] font-bold">getEcosystemHealthMetrics(claims: AUTHORITY)</div>
              </div>

              <div className="p-4 bg-[#ebf7ee] text-[#0d2922] rounded-2xl text-[13px] leading-relaxed border border-[#badac3]/40 font-sans-ui">
                Todas las organizaciones se encuentran en balance contable exacto. Cero discrepancias en el general ledger. Fondo estudiantil 100% conciliado con precisión de partida doble.
              </div>
            </div>
          )}

        </div>

        {/* Modal Bottom Bar */}
        <div className="bg-[#fafbfc] px-6 py-4 border-t border-black/[0.06] flex items-center justify-between text-[12px] text-[#66746e] font-sans-ui">
          <span className="font-mono-code">Unidad Educativa Surcos · PRD v1.0 Fuente de Verdad</span>
          <button
            onClick={handleClose}
            className="px-5 py-1.5 rounded-full text-[12px] font-medium text-[#111816] bg-black/[0.05] hover:bg-black/[0.1] active:scale-[0.98] transition-system cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
