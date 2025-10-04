// File: src/app/(auth)/register/page.js
import RegisterForm from "@/components/features/auth/register-form";
import Logo from "@/components/shared/logo";

// Registration page encouraging visitors to join the platform.
export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between px-6 py-4">
        <Logo />
      </div>
      <div className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 lg:grid-cols-2 lg:items-center">
        <div className="hidden space-y-6 rounded-3xl bg-gradient-to-br from-primary/10 via-background to-background p-12 lg:block">
          <h2 className="text-3xl font-semibold">Create your account</h2>
          <p className="text-sm text-muted-foreground">
            Unlock dashboards, reports, and plan management features tailored to growing teams.
          </p>
          <ul className="space-y-3 text-sm">
            <li>• Unlimited manual transactions</li>
            <li>• Automated plan-based resource access</li>
            <li>• Secure authentication with refresh tokens</li>
          </ul>
        </div>
        <div className="flex justify-center">
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}
