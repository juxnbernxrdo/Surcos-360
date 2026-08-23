"use client";

import React, { useState, useMemo } from "react";
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

export default function RegisterPage() {
  const router = useRouter();
  const { registerInstitutional, login } = useAuth();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    institutionalCode: "",
    course: "3ro BGU \"A\"",
    tutor: "",
    token: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  // Deterministic detection per PRD §3.3
  const isStudentEmail = useMemo(() => {
    return /^[a-zA-Z0-9._%+-]+_est@colegiosurcos\.edu\.ec$/i.test(
      formData.email.trim()
    );
  }, [formData.email]);

  const isInstitutionalDomain = useMemo(() => {
    return formData.email.trim().toLowerCase().endsWith("@colegiosurcos.edu.ec");
  }, [formData.email]);

  const validateForm = () => {
    const errors: Record<string, string | undefined> = {};

    if (!formData.firstName.trim()) {
      errors.firstName = "Ingresa tu nombre";
    }

    if (!formData.lastName.trim()) {
      errors.lastName = "Ingresa tu apellido";
    }

    if (!formData.email.trim()) {
      errors.email = "Ingresa tu correo institucional";
    } else if (!formData.email.trim().toLowerCase().endsWith("@colegiosurcos.edu.ec")) {
      errors.email = "Solo se permite registro con dominio institucional @colegiosurcos.edu.ec";
    }

    if (!formData.password) {
      errors.password = "Ingresa una contraseña";
    } else if (formData.password.length < 8) {
      errors.password = "La contraseña debe tener al menos 8 caracteres";
    }

    if (isStudentEmail && !formData.course.trim()) {
      errors.course = "El curso es obligatorio para estudiantes";
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
      await registerInstitutional({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        institutionalCode: formData.institutionalCode.trim() || undefined,
        course: isStudentEmail ? formData.course.trim() : undefined,
        tutor: isStudentEmail && formData.tutor.trim() ? formData.tutor.trim() : undefined,
        token: formData.token.trim() || undefined,
      });

      setSuccessMessage("¡Registro exitoso! Iniciando sesión...");

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
          setErrorMessage("Ya existe una cuenta registrada con este correo electrónico o código institucional.");
        } else if (err.statusCode === 400 && err.messages.some((m) => m.includes("INVALID_INSTITUTIONAL_DOMAIN"))) {
          setErrorMessage("Dominio no válido. Solo se admiten correos institucionales terminados en @colegiosurcos.edu.ec.");
        } else {
          setErrorMessage(err.messages.join(". "));
        }
      } else {
        setErrorMessage("Error al registrar cuenta institucional. Intenta de nuevo.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      kicker="Nueva cuenta"
      title="Crear cuenta institucional"
      subtitle="Exclusivo para estudiantes, docentes y directivos de la Unidad Educativa Surcos."
      statement="Un solo acceso para el ahorro estudiantil, las PYMES escolares y el acompañamiento académico."
      footerContent={
        <div className="space-y-2.5">
          <p className="text-[13.5px] text-[#4b5853]">
            ¿Ya tienes cuenta activa?{" "}
            <Link
              href="/auth/login"
              className="font-semibold text-[#0d2922] pointer-hover:hover:text-[#153b32] underline underline-offset-4 decoration-black/15 pointer-hover:hover:decoration-[#0d2922] transition-system"
            >
              Iniciar sesión
            </Link>
          </p>
          <Link
            href="/auth/register-representative"
            className="group inline-flex items-center gap-1 text-[13px] text-[#66746e] pointer-hover:group-hover:text-[#111816] transition-system rounded-md py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6a4f]"
          >
            <span>¿Eres representante legal? Regístrate con tu token</span>
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

        {successMessage && (
          <AuthNotice type="success" message={successMessage} />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3.5 gap-y-5">
          <FormField
            label="Nombres"
            name="firstName"
            autoComplete="given-name"
            placeholder="Juan"
            value={formData.firstName}
            onChange={(e) => handleChange("firstName", e.target.value)}
            error={fieldErrors.firstName}
            required
          />

          <FormField
            label="Apellidos"
            name="lastName"
            autoComplete="family-name"
            placeholder="Pérez"
            value={formData.lastName}
            onChange={(e) => handleChange("lastName", e.target.value)}
            error={fieldErrors.lastName}
            required
          />
        </div>

        <FormField
          label="Correo Institucional"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="nombre_est@colegiosurcos.edu.ec"
          value={formData.email}
          onChange={(e) => handleChange("email", e.target.value)}
          error={fieldErrors.email}
          success={isInstitutionalDomain && !fieldErrors.email}
          helperText={
            isInstitutionalDomain
              ? undefined
              : "El correo debe terminar en @colegiosurcos.edu.ec"
          }
          required
        />

        {/* Detected profile — quiet status line, not a box */}
        {formData.email.length > 5 && isInstitutionalDomain && (
          <p
            role="status"
            className="flex items-center gap-2 text-[12.5px] text-[#2d6a4f] animate-tab-content -mt-1"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#2d6a4f] shrink-0" />
            {isStudentEmail
              ? "Perfil de estudiante — el sufijo “_est” activa tu fondo de ahorro."
              : "Perfil de personal docente o directivo."}
          </p>
        )}

        {isStudentEmail && (
          <div className="space-y-5 animate-tab-content">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3.5 gap-y-5">
              <FormField
                label="Curso / Nivel"
                name="course"
                placeholder='3ro BGU "A"'
                value={formData.course}
                onChange={(e) => handleChange("course", e.target.value)}
                error={fieldErrors.course}
                required
              />

              <FormField
                label="Tutor Asignado"
                name="tutor"
                placeholder="Lic. Marco González"
                value={formData.tutor}
                onChange={(e) => handleChange("tutor", e.target.value)}
              />
            </div>
          </div>
        )}

        <FormField
          label="Código Institucional"
          name="institutionalCode"
          autoComplete="off"
          placeholder="Opcional — si lo tienes"
          value={formData.institutionalCode}
          onChange={(e) => handleChange("institutionalCode", e.target.value)}
        />

        <PasswordField
          label="Contraseña"
          name="password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          value={formData.password}
          onChange={(e) => handleChange("password", e.target.value)}
          error={fieldErrors.password}
          success={formData.password.length >= 8 && !fieldErrors.password}
          required
        />

        <div className="pt-1">
          <AuthButton type="submit" isLoading={isLoading} variant="primary">
            Crear Cuenta Institucional
          </AuthButton>
        </div>
      </form>
    </AuthLayout>
  );
}