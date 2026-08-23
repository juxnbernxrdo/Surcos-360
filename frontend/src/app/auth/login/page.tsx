"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth/auth-layout";
import { FormField } from "@/components/auth/form-field";
import { PasswordField } from "@/components/auth/password-field";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthNotice } from "@/components/auth/auth-notice";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";
import { ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const validateForm = () => {
    const errors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errors.email = "Ingresa tu correo electrónico";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Ingresa un formato de correo válido";
    }

    if (!password) {
      errors.password = "Ingresa tu contraseña";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 401) {
          setErrorMessage("Correo o contraseña incorrectos. Verifica tus credenciales.");
        } else if (err.statusCode === 403) {
          setErrorMessage("Tu cuenta se encuentra inactiva o suspendida por administración.");
        } else if (err.statusCode === 404) {
          setErrorMessage("No existe un perfil institucional vinculado a este correo.");
        } else if (err.statusCode === 429) {
          setErrorMessage("Demasiados intentos fallidos. Por seguridad, espera un minuto antes de reintentar.");
        } else {
          setErrorMessage(err.messages.join(". "));
        }
      } else {
        setErrorMessage("Ocurrió un error al iniciar sesión. Intenta nuevamente.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      kicker="Acceso"
      title="Iniciar sesión"
      subtitle="Accede al portal estudiantil o a la administración de tu PYME con tu credencial institucional."
      statement="El punto de entrada a tu ahorro, tus finanzas y la vida académica de Surcos."
      footerContent={
        <div className="space-y-2.5">
          <p className="text-[13.5px] text-[#4b5853]">
            ¿Aún no tienes cuenta institucional?{" "}
            <Link
              href="/auth/register"
              className="font-semibold text-[#0d2922] pointer-hover:hover:text-[#153b32] underline underline-offset-4 decoration-black/15 pointer-hover:hover:decoration-[#0d2922] transition-system"
            >
              Regístrate
            </Link>
          </p>
          <Link
            href="/auth/register-representative"
            className="group inline-flex items-center gap-1 text-[13px] text-[#66746e] pointer-hover:group-hover:text-[#111816] transition-system rounded-md py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6a4f]"
          >
            <span>Padres y representantes con invitación</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 ease-out pointer-hover:group-hover:translate-x-0.5" />
          </Link>
        </div>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {errorMessage && (
          <AuthNotice
            type="error"
            message={errorMessage}
            onDismiss={() => setErrorMessage(null)}
          />
        )}

        <FormField
          label="Correo Electrónico"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="nombre_est@colegiosurcos.edu.ec"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined });
          }}
          error={fieldErrors.email}
          required
        />

        <PasswordField
          label="Contraseña"
          name="password"
          autoComplete="current-password"
          placeholder="Ingresa tu contraseña"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined });
          }}
          error={fieldErrors.password}
          hint={
            <Link
              href="/auth/forgot-password"
              className="text-[12.5px] font-medium text-[#66746e] pointer-hover:hover:text-[#111816] underline underline-offset-2 decoration-black/15 transition-system"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          }
          required
        />

        <div className="pt-1">
          <AuthButton type="submit" isLoading={isLoading} variant="primary">
            Ingresar al Sistema
          </AuthButton>
        </div>
      </form>
    </AuthLayout>
  );
}