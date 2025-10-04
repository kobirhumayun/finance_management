// File: src/app/(auth)/request-password-reset/page.js
import { RequestPasswordResetForm } from "@/components/features/auth/reset-password-form";
import Logo from "@/components/shared/logo";

// Page allowing a user to request a password reset email.
export default function RequestPasswordResetPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between px-6 py-4">
        <Logo />
      </div>
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-10 px-6 pb-20 text-center">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold">Forgot your password?</h1>
          <p className="text-sm text-muted-foreground">
            Enter your email to receive a one-time password and instructions to reset your credentials.
          </p>
        </div>
        <RequestPasswordResetForm />
      </div>
    </div>
  );
}
