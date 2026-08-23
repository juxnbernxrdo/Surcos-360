import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0d2922",
};

export const metadata: Metadata = {
  title: "Surcos 360 — Plataforma Integral Empresarial, Financiera y Educativa",
  description:
    "El sistema operativo central de la Unidad Educativa Surcos. Unifica el ahorro estudiantil, cuatro organizaciones operativas (Surcos Saving, AgroRed, Surcos Fit, Surcasino), contabilidad de partida doble inmutable y analítica gobernada.",
  keywords: [
    "Surcos 360",
    "Unidad Educativa Surcos",
    "Educación Financiera",
    "Partida Doble",
    "General Ledger",
    "AgroRed",
    "Surcos Fit",
    "Surcasino",
    "Surcos Saving",
    "PYMES Escolares",
  ],
  authors: [{ name: "Unidad Educativa Surcos" }],
  robots: "index, follow",
  openGraph: {
    title: "Surcos 360 — Plataforma Integral Empresarial, Financiera y Educativa",
    description:
      "Conecta la experiencia educativa con la gestión empresarial y el rigor contable del ecosistema Surcos.",
    type: "website",
    locale: "es_EC",
    siteName: "Surcos 360",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased scroll-smooth`}
    >
      <body className="min-h-full flex flex-col bg-[#f6f7f6] text-[#111816]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
