// File: src/components/features/auth/login-form.js
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Mail } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const schema = z.object({
  identifier: z.string().min(1, "Username or email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Login form hooked up to Auth.js credentials provider with validation.
export default function LoginForm() {
  const router = useRouter();
  const { update } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { identifier: "", password: "" },
  });

  const onSubmit = async (values) => {
    setIsSubmitting(true);
    try {
      const result = await signIn("credentials", {
        ...values,
        redirect: false,
      });

      if (result?.error) {
        toast.error(result.error || "Invalid credentials");
        return;
      }

      const session = await update();
      const role = session?.user?.role;
      toast.success("Welcome back to FinTrack");
      router.replace(role === "admin" ? "/admin/dashboard" : "/dashboard");
    } catch (error) {
      toast.error("Unable to sign in. Please try again.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl">Sign in to your account</CardTitle>
        <CardDescription>Access your dashboards, projects, and analytics.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identifier">Username or Email</Label>
            <Input id="identifier" placeholder="kobirhumayun" disabled={isSubmitting} {...form.register("identifier")} />
            {form.formState.errors.identifier && (
              <p className="text-sm text-destructive">{form.formState.errors.identifier.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="Enter your password" disabled={isSubmitting} {...form.register("password")} />
            {form.formState.errors.password && (
              <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>
          <div className="flex items-center justify-between text-sm">
            <Button type="button" variant="link" className="px-0" onClick={() => router.push("/request-password-reset")}>Forgot password?</Button>
            <Button type="button" variant="link" className="px-0" onClick={() => router.push("/register")}>Create account</Button>
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign In"}
          </Button>
        </form>
        <div className="space-y-4">
          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
              or
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => toast.info("Google sign-in is coming soon")}
          >
            <Mail className="mr-2 h-4 w-4" /> Continue with Google
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
