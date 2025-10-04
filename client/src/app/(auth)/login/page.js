// File: src/app/(auth)/login/page.js
import LoginForm from "@/components/features/auth/login-form";
import Logo from "@/components/shared/logo";

// Login page featuring a two-column marketing layout.
export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between px-6 py-4">
        <Logo />
      </div>
      <div className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 lg:grid-cols-2 lg:items-center">
        <div className="hidden space-y-6 rounded-3xl bg-gradient-to-br from-primary/10 via-background to-background p-12 lg:block">
          <h2 className="text-3xl font-semibold">Welcome back to FinTrack</h2>
          <p className="text-sm text-muted-foreground">
            Track cash flow, manage subscriptions, and keep your projects profitable with real-time analytics.
          </p>
          <ul className="space-y-3 text-sm">
            <li>• Automated budgeting and alerts</li>
            <li>• Collaborative project workspaces</li>
            <li>• Detailed financial reports with export support</li>
          </ul>
        </div>
        <div className="flex justify-center">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
