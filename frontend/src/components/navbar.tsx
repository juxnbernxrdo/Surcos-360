"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, LogIn, UserPlus, LogOut } from "lucide-react";
import { useAuth } from "@/context/auth-context";

interface NavbarProps {
  onOpenDemo?: () => void;
}

export function Navbar({ onOpenDemo: _onOpenDemo }: NavbarProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 16);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // IntersectionObserver for Scrollspy
  useEffect(() => {
    const sectionIds = ["ecosistema", "estudiantes", "ledger", "ia", "seguridad", "roadmap"];
    const observers: IntersectionObserver[] = [];

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveSection(id);
            }
          });
        },
        { rootMargin: "-20% 0px -60% 0px" }
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => {
      observers.forEach((obs) => obs.disconnect());
    };
  }, []);

  const navLinks = [
    { id: "ecosistema", label: "Ecosistema", href: "#ecosistema" },
    { id: "estudiantes", label: "Estudiantes", href: "#estudiantes" },
    { id: "ledger", label: "Ledger", href: "#ledger" },
    { id: "ia", label: "IA & RAG", href: "#ia" },
    { id: "seguridad", label: "Seguridad", href: "#seguridad" },
    { id: "roadmap", label: "Roadmap", href: "#roadmap" },
  ];

  const userInitials = user
    ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase()
    : "";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-system-smooth ${
        isScrolled
          ? "bg-[#f6f7f6]/90 backdrop-blur-xl border-b border-black/[0.06] py-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          
          {/* Brand Mark */}
          <Link
            href="/"
            className="flex items-baseline gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6a4f] rounded-full p-1 group"
          >
            <span className="font-bold text-[16px] tracking-tight text-[#111816] font-sans-ui group-hover:text-[#0d2922] transition-system">
              Surcos 360
            </span>
            <span className="hidden sm:inline text-[11px] text-[#66746e] font-normal font-sans-ui">
              Unidad Educativa Surcos
            </span>
          </Link>

          {/* Desktop Navigation Links (Pill Style with Active Scrollspy) */}
          <nav className="hidden md:flex items-center gap-0.5 bg-black/[0.03] p-1 rounded-full border border-black/[0.04] relative">
            {navLinks.map((link) => {
              const isActive = activeSection === link.id;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={`px-3.5 py-1.5 text-[13px] rounded-full transition-system font-medium font-sans-ui relative ${
                    isActive
                      ? "text-[#111816] bg-white shadow-sm font-semibold"
                      : "text-[#4b5853] hover:text-[#111816] hover:bg-white/60"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>

          {/* Action CTAs: Iniciar Sesión & Regístrate */}
          <div className="hidden sm:flex items-center gap-2">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2 animate-tab-content">
                <div className="flex items-center gap-2 px-3 py-1 bg-white border border-black/[0.08] rounded-full shadow-sm">
                  <div className="w-5 h-5 rounded-full bg-[#0d2922] text-white flex items-center justify-center text-[10px] font-bold font-mono-code">
                    {userInitials || "U"}
                  </div>
                  <span className="text-[12.5px] font-semibold text-[#111816] font-sans-ui max-w-[120px] truncate">
                    {user.firstName}
                  </span>
                </div>

                <button
                  onClick={() => logout()}
                  title="Cerrar sesión"
                  className="p-2 text-[#66746e] hover:text-[#9b2c2c] hover:bg-[#fff5f5] rounded-full transition-system cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="px-4 py-1.5 text-[13px] font-medium text-[#4b5853] hover:text-[#111816] bg-white hover:bg-[#f6f7f6] active:scale-[0.985] border border-black/[0.08] rounded-full transition-system font-sans-ui shadow-sm flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6a4f]"
                >
                  <LogIn className="w-3.5 h-3.5 opacity-70" />
                  <span>Iniciar Sesión</span>
                </Link>

                <Link
                  href="/auth/register"
                  className="px-4 py-1.5 text-[13px] font-semibold text-white bg-[#0d2922] hover:bg-[#153b32] active:scale-[0.985] rounded-full transition-system shadow-sm flex items-center gap-1.5 font-sans-ui focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6a4f]"
                >
                  <UserPlus className="w-3.5 h-3.5 opacity-80" />
                  <span>Regístrate</span>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
              className="p-2 text-[#4b5853] hover:text-[#111816] hover:bg-black/[0.04] active:scale-95 rounded-full transition-system cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer (Smooth Transition) */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-200 ease-out ${
          mobileMenuOpen ? "max-h-96 opacity-100 border-b border-black/[0.08]" : "max-h-0 opacity-0"
        } bg-[#f6f7f6]/95 backdrop-blur-xl px-5`}
      >
        <div className="py-4 space-y-3">
          <div className="space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 text-[14px] font-medium rounded-xl transition-system font-sans-ui ${
                  activeSection === link.id
                    ? "text-[#111816] bg-black/[0.06] font-semibold"
                    : "text-[#4b5853] hover:text-[#111816] hover:bg-black/[0.04]"
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="pt-3 border-t border-black/[0.06] flex flex-col gap-2">
            {isAuthenticated && user ? (
              <div className="space-y-2">
                <div className="px-3 py-2 bg-white rounded-xl border border-black/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#0d2922] text-white flex items-center justify-center text-[10px] font-bold">
                      {userInitials || "U"}
                    </div>
                    <div className="text-[13px] font-semibold text-[#111816]">
                      {user.firstName} {user.lastName}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono-code bg-[#ebf7ee] text-[#2d6a4f] px-2 py-0.5 rounded-full font-bold">
                    {user.userType}
                  </span>
                </div>

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full py-2.5 text-[13px] font-medium text-[#9b2c2c] bg-[#fff5f5] rounded-full transition-system flex items-center justify-center gap-1.5 font-sans-ui"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 text-[13px] font-medium text-[#111816] bg-white border border-black/[0.08] shadow-sm rounded-full transition-system flex items-center justify-center gap-1.5 font-sans-ui"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Iniciar Sesión</span>
                </Link>

                <Link
                  href="/auth/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 text-[13px] font-semibold text-white bg-[#0d2922] rounded-full transition-system flex items-center justify-center gap-1.5 font-sans-ui"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Regístrate</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

