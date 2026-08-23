"use client";

import React, { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { EcosystemShowcase } from "@/components/ecosystem-showcase";
import { StudentExperience } from "@/components/student-experience";
import { LedgerEngine } from "@/components/ledger-engine";
import { GovernedAI } from "@/components/governed-ai";
import { SecurityDefense } from "@/components/security-defense";
import { Roadmap } from "@/components/roadmap";
import { CTASection } from "@/components/cta-section";
import { Footer } from "@/components/footer";
import { InteractivePreviewModal } from "@/components/interactive-preview-modal";

export default function Home() {
  const [demoModalOpen, setDemoModalOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col selection:bg-[#badac3] selection:text-[#061915]">
      {/* Navigation */}
      <Navbar onOpenDemo={() => setDemoModalOpen(true)} />

      {/* Main Content Sections */}
      <main className="flex-grow">
        {/* 1. Hero Section */}
        <Hero onOpenDemo={() => setDemoModalOpen(true)} />

        {/* 2. Ecosistema Surcos (4 Organizaciones) */}
        <EcosystemShowcase />

        {/* 3. Experiencia Estudiantil & Autonomía */}
        <StudentExperience />

        {/* 4. Motor Contable & General Ledger */}
        <LedgerEngine />

        {/* 5. Inteligencia Artificial & RAG */}
        <GovernedAI />

        {/* 6. Seguridad Enterprise & Auditoría */}
        <SecurityDefense />

        {/* 7. Roadmap & Futuro */}
        <Roadmap />

        {/* 8. Conversión & Acceso Institucional */}
        <CTASection onOpenDemo={() => setDemoModalOpen(true)} />
      </main>

      {/* Footer */}
      <Footer />

      {/* Interactive Exploration Modal */}
      <InteractivePreviewModal
        isOpen={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
      />
    </div>
  );
}
