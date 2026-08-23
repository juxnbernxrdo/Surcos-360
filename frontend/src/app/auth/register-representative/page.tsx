"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/auth/auth-layout";
import { FormField } from "@/components/auth/form-field";
import { TokenField } from "@/components/auth/token-field";
import { PasswordField } from "@/components/auth/password-field";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthNotice } from "@/components/auth/auth-notice";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";

function RegisterRepresentativeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { registerRepresentative, login } = useAuth();

  const tokenParam = searchParams.get("token") || "";

  const [formData, setFormData] = useState({
    token: tokenParam,
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phoneNumber: "",
    identificationNumber: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  const validateForm = () => {
    const errors: Record<string, string | undefined> = {};
    const activeToken = formData.token.trim() || tokenParam.trim();

    if (!activeToken) {
      errors.token = "El token de invitación es requerido para representantes";
    }

    if (!formData.firstName.trim()) {
      errors.firstName = "Ingresa tu nombre";
    }

    if (!formData.lastName.trim()) {
      errors.lastName = "Ingresa tu apellido";
    }

    if (!formData.email.trim()) {
      errors.email = "Ingresa tu correo personal";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = "Ingresa un formato de correo válido";
    }

    if (!formData.password) {
      errors.password = "Ingresa una contraseña";
    } else if (formData.password.length < 8) {
      errors.password = "La contraseña debe tener al menos 8 caracteres";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const activeToken = formData.token.trim() || tokenParam.trim();
      await registerRepresentative({
        token: activeToken,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        phoneNumber: formData.phoneNumber.trim() || undefined,
        identificationNumber: formData.identificationNumber.trim() || undefined,
      });

      setSuccessMessage("¡Cuenta de representante vinculada exitosamente! Iniciando sesión...");

      try {
        await login(formData.email.trim().toLowerCase(), formData.password);
        setTimeout(() => {
          router.push("/");
        }, 800);
      } catch {
        router.push("/auth/login");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 409) {
          setErrorMessage("El estudiante ya cuenta con un representante registrado o el correo ya está en uso.");
        } else if (err.statusCode === 404) {
          setErrorMessage("El token de invitación no es válido, ha expirado o el estudiante no fue encontrado.");
        } else {
          setErrorMessage(err.messages.join(". "));
        }
      } else {
        setErrorMessage("Error al registrar representante. Verifica el token o solicita una nueva invitación.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      kicker="Padres y representantes"
      title="Vincular cuenta de representante"
      subtitle="Regístrate con tu token de invitación para acceder al expediente financiero de tu representado."
      statement="El acceso del padre o representante a la vida financiera y académica del estudiante."
      footerContent={
        <p className="text-[13.5px] text-[#4b5853]">
          ¿Ya tienes cuenta activa?{" "}
          <Link
            href="/auth/login"
            className="font-semibold text-[#0d2922] pointer-hover:hover:text-[#153b32] underline underline-offset-4 decoration-black/15 pointer-hover:hover:decoration-[#0d2922] transition-system"
          >
            Iniciar sesión
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4 sm:space-y-4.5">
        {errorMessage && (
          <AuthNotice
            type="error"
            message={errorMessage}
            onDismiss={() => setErrorMessage(null)}
          />
        )}

        {successMessage && (
          <AuthNotice type="success" message={successMessage} />
        )}

        <TokenField
          label="Token de Invitación"
          value={formData.token}
          onChangeValue={(val) => handleChange("token", val)}
          error={fieldErrors.token}
          isValidating={isLoading}
          isValid={!!formData.token.trim() && !fieldErrors.token}
          helperText="Encuentra tu código en el correo de invitación enviado por la institución."
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3.5 gap-y-4 sm:gap-y-4.5">
          <FormField
            label="Nombres"
            name="firstName"
            autoComplete="given-name"
            placeholder="María"
            value={formData.firstName}
            onChange={(e) => handleChange("firstName", e.target.value)}
            error={fieldErrors.firstName}
            required
          />

          <FormField
            label="Apellidos"
            name="lastName"
            autoComplete="family-name"
            placeholder="Rodríguez"
            value={formData.lastName}
            onChange={(e) => handleChange("lastName", e.target.value)}
            error={fieldErrors.lastName}
            required
          />
        </div>

        <FormField
          label="Correo Personal"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="maria.rodriguez@gmail.com"
          value={formData.email}
          onChange={(e) => handleChange("email", e.target.value)}
          error={fieldErrors.email}
          helperText="Usa un correo personal (Gmail, Outlook, etc.) para recibir notificaciones."
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3.5 gap-y-4 sm:gap-y-4.5">
          <FormField
            label="Cédula"
            name="identificationNumber"
            autoComplete="off"
            placeholder="1718293849"
            value={formData.identificationNumber}
            onChange={(e) => handleChange("identificationNumber", e.target.value)}
          />

          <FormField
            label="Celular"
            name="phoneNumber"
            type="tel"
            autoComplete="tel"
            placeholder="0991234567"
            value={formData.phoneNumber}
            onChange={(e) => handleChange("phoneNumber", e.target.value)}
          />
        </div>

        <PasswordField
          label="Crear Contraseña"
          name="password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          value={formData.password}
          onChange={(e) => handleChange("password", e.target.value)}
          error={fieldErrors.password}
          required
        />

        <div className="pt-2">
          <AuthButton type="submit" isLoading={isLoading} variant="primary">
            Crear cuenta y vincular
          </AuthButton>
        </div>
      </form>
    </AuthLayout>
  );
}

export default function RegisterRepresentativePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-[#f6f7f6] flex items-center justify-center font-sans-ui">
          <div className="text-sm font-medium text-[#4b5853]">
            Cargando módulo de registro…
          </div>
        </div>
      }
    >
      <RegisterRepresentativeContent />
    </Suspense>
  );
}