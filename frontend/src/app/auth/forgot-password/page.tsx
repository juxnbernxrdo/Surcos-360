"use client";

import React, { useState } from "react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { FormField } from "@/components/auth/form-field";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthNotice } from "@/components/auth/auth-notice";
import { SuccessScreen } from "@/components/auth/success-screen";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const { recoverPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | undefined>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setEmailError(undefined);

    if (!email.trim()) {
      setEmailError("Ingresa tu correo electrónico");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Ingresa un correo electrónico válido");
      return;
    }

    setIsLoading(true);

    try {
      await recoverPassword(email.trim().toLowerCase());
      setIsSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 429) {
          setErrorMessage("Has solicitado restablecimiento recientemente. Espera unos minutos antes de intentar de nuevo.");
        } else {
          setErrorMessage(err.messages.join(". "));
        }
      } else {
        setErrorMessage("Error al procesar la solicitud. Intenta nuevamente.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      kicker="Recuperación"
      title="Recuperar contraseña"
      subtitle="Enviaremos un enlace seguro a tu correo para restablecer el acceso a tu cuenta."
      statement="Recuperar tu acceso no debería interrumpir tu rutina ni la de tu institución."
      backHref="/auth/login"
      backLabel="Volver a iniciar sesión"
    >
      {isSubmitted ? (
        <SuccessScreen
          title="Revisa tu correo"
          description={`Si existe una cuenta asociada a ${email}, recibirás un enlace seguro con las instrucciones para restablecer tu acceso.`}
          note="Revisa también la carpeta de correo no deseado (spam). El enlace expira automáticamente por seguridad."
          actionHref="/auth/login"
          actionLabel="Volver a iniciar sesión"
          actionVariant="outline"
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

          <FormField
            label="Correo Electrónico Registrado"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="nombre_est@colegiosurcos.edu.ec"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(undefined);
            }}
            error={emailError}
            helperText="Ingresa el correo institucional o personal vinculado a tu perfil."
            required
          />

          <div className="pt-1">
            <AuthButton type="submit" isLoading={isLoading} variant="primary">
              Enviar Instrucciones de Recuperación
            </AuthButton>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}