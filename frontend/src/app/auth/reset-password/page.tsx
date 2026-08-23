"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/auth/auth-layout";
import { PasswordField } from "@/components/auth/password-field";
import { FormField } from "@/components/auth/form-field";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthNotice } from "@/components/auth/auth-notice";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { SuccessScreen } from "@/components/auth/success-screen";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resetPassword } = useAuth();

  const tokenParam = searchParams.get("token") || "";

  const [token, setToken] = useState(tokenParam);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    token?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  // Real-time password criteria
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);

  const validateForm = () => {
    const errors: { token?: string; newPassword?: string; confirmPassword?: string } = {};

    const activeToken = token.trim() || tokenParam.trim();
    if (!activeToken) {
      errors.token = "El token de restablecimiento es requerido";
    }

    if (!newPassword) {
      errors.newPassword = "Crea una nueva contraseña";
    } else if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber) {
      errors.newPassword =
        "La contraseña debe cumplir con los requisitos mínimos de seguridad";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Confirma tu nueva contraseña";
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = "Las contraseñas no coinciden";
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
      const activeToken = token.trim() || tokenParam.trim();
      await resetPassword(activeToken, newPassword);
      setIsSuccess(true);
      setTimeout(() => {
        router.push("/auth/login");
      }, 1400);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.messages.join(". "));
      } else {
        setErrorMessage("Error al restablecer la contraseña. El token puede haber expirado.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      kicker="Recuperación"
      title="Crear nueva contraseña"
      subtitle="Define una clave segura para recuperar el acceso a tu cuenta institucional."
      statement="Tu clave es la llave a tu ahorro y a tu vida académica. Elige una que recuerdes."
      backHref="/auth/login"
      backLabel="Volver a iniciar sesión"
    >
      {isSuccess ? (
        <SuccessScreen
          title="Contraseña actualizada"
          description="Tu clave se ha modificado exitosamente. Redirigiéndote a la pantalla de acceso…"
          actionHref="/auth/login"
          actionLabel="Iniciar Sesión Ahora"
        />
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {errorMessage && (
            <AuthNotice
              type="error"
              message={errorMessage}
              onDismiss={() => setErrorMessage(null)}
            />
          )}

          {!tokenParam && (
            <FormField
              label="Token de Restablecimiento"
              name="token"
              autoComplete="off"
              placeholder="Pega el token recibido por correo"
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                if (fieldErrors.token) setFieldErrors({ ...fieldErrors, token: undefined });
              }}
              error={fieldErrors.token}
              required
            />
          )}

          <PasswordField
            label="Nueva Contraseña"
            name="newPassword"
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              if (fieldErrors.newPassword) setFieldErrors({ ...fieldErrors, newPassword: undefined });
            }}
            error={fieldErrors.newPassword}
            success={hasMinLength && !fieldErrors.newPassword}
            required
          />

          <PasswordRequirements value={newPassword} />

          <PasswordField
            label="Confirmar Contraseña"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Repite la nueva contraseña"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (fieldErrors.confirmPassword) setFieldErrors({ ...fieldErrors, confirmPassword: undefined });
            }}
            error={fieldErrors.confirmPassword}
            success={
              !!confirmPassword &&
              newPassword === confirmPassword &&
              !fieldErrors.confirmPassword
            }
            required
          />

          <div className="pt-1">
            <AuthButton type="submit" isLoading={isLoading} variant="primary">
              Guardar Nueva Contraseña
            </AuthButton>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-[#f6f7f6] flex items-center justify-center font-sans-ui">
          <div className="text-sm font-medium text-[#4b5853]">
            Cargando módulo de restablecimiento…
          </div>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}