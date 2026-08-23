"use client";

import React, { useState } from "react";
import { Lock, ArrowRight, CheckCircle2 } from "lucide-react";

interface CTASectionProps {
  onOpenDemo?: () => void;
}

export function CTASection({ onOpenDemo }: CTASectionProps) {
  const [showAccessFeedback, setShowAccessFeedback] = useState(false);

  const handleInstitutionalAccess = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowAccessFeedback(true);
    setTimeout(() => {
      if (onOpenDemo) onOpenDemo();
      setShowAccessFeedback(false);
    }, 600);
  };

  return (
    <section id="acceso" className="py-28 sm:py-36 bg-[#0d2922] text-white overflow-hidden relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
        
        {/* Headline with Instrument Serif */}
        <h2 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.08] text-balance font-sans-ui">
          Ingresa al ecosistema{" "}
          <span className="font-serif-display italic font-normal text-[#d8f3dc] text-[1.12em] tracking-normal">
            Surcos 360
          </span>
          .
        </h2>

        {/* Supporting Copy */}
        <p className="text-base sm:text-xl text-white/80 leading-relaxed max-w-2xl mx-auto font-sans-ui text-balance">
          Accede con tu cuenta institucional <code className="text-white font-mono-code bg-white/10 px-2.5 py-0.5 rounded-full text-[13px]">@colegiosurcos.edu.ec</code> para gestionar tu portal de autoservicio o la administración de las organizaciones escolares.
        </p>

        {/* Action CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <button
            onClick={handleInstitutionalAccess}
            className="px-8 py-3.5 rounded-full font-semibold text-[14px] text-[#0d2922] bg-white hover:bg-[#f6f7f6] active:scale-[0.985] transition-system shadow-sm flex items-center gap-2.5 font-sans-ui cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {showAccessFeedback ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#2d6a4f]" />
                <span>Conectando SSO Institucional...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Ingreso Institucional</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <button
            onClick={onOpenDemo}
            className="px-7 py-3.5 rounded-full font-medium text-[14px] text-white bg-white/10 hover:bg-white/15 active:scale-[0.985] transition-system font-sans-ui border border-white/10 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Ver Demostración
          </button>
        </div>

        {/* Role Segment Metadata */}
        <div className="pt-8 border-t border-white/10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-white/60 font-sans-ui">
          <span>Estudiantes</span>
          <span className="text-white/20">·</span>
          <span>Docentes</span>
          <span className="text-white/20">·</span>
          <span>Administradores PYME</span>
          <span className="text-white/20">·</span>
          <span>Autoridades</span>
        </div>

      </div>
    </section>
  );
}
