// File: src/app/(auth)/reset-password/page.js
import { ResetPasswordForm } from "@/components/features/auth/reset-password-form";
import Logo from "@/components/shared/logo";

// Page for submitting OTP and a new password.
export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between px-6 py-4">
        <Logo />
      </div>
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-10 px-6 pb-20 text-center">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold">Reset your password</h1>
          <p className="text-sm text-muted-foreground">
            Provide the one-time password sent to your inbox along with a secure new password.
          </p>
        </div>
        <ResetPasswordForm />
      </div>
    </div>
  );
}
