// File: src/components/features/auth/reset-password-form.js
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const resetSchema = z
  .object({
    email: z.string().email("Enter a valid email"),
    otp: z.string().regex(/^\d{6}$/u, "OTP must be a 6-digit code"),
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

// Form used on the reset password page to submit OTP and new credentials.
export function ResetPasswordForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const form = useForm({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: "", otp: "", newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    const email = searchParams.get("email");
    if (email) {
      form.setValue("email", email);
    }
  }, [form, searchParams]);

  const onSubmit = async (values) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/password-reset/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email, otp: values.otp, newPassword: values.newPassword }),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(body?.message || "Unable to reset password");
        return;
      }

      toast.success(body?.message || "Password updated. You can now sign in with your new password.");
      form.reset({ email: "", otp: "", newPassword: "", confirmPassword: "" });
      router.push("/login");
    } catch (error) {
      toast.error("Network error. Please try again later.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl">Reset your password</CardTitle>
        <CardDescription>Enter the OTP sent to your email and choose a new password.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" disabled={isSubmitting} {...form.register("email")} />
            {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="otp">One-Time Password</Label>
            <Input id="otp" placeholder="123456" disabled={isSubmitting} {...form.register("otp")} />
            {form.formState.errors.otp && <p className="text-sm text-destructive">{form.formState.errors.otp.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input id="newPassword" type="password" disabled={isSubmitting} {...form.register("newPassword")} />
            {form.formState.errors.newPassword && (
              <p className="text-sm text-destructive">{form.formState.errors.newPassword.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input id="confirmPassword" type="password" disabled={isSubmitting} {...form.register("confirmPassword")} />
            {form.formState.errors.confirmPassword && (
              <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Reset Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

const requestSchema = z.object({ email: z.string().email("Enter a valid email") });

// Form used to request a password reset OTP via email.
export function RequestPasswordResetForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const form = useForm({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(body?.message || "Unable to send reset email");
        return;
      }

      toast.success(body?.message || "OTP sent to your email. Check your inbox.");
      form.reset({ email: values.email });
      router.push(`/reset-password?email=${encodeURIComponent(values.email)}`);
    } catch (error) {
      toast.error("Network error. Please try again later.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl">Forgot your password?</CardTitle>
        <CardDescription>Enter your email address and we will send you a reset code.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
            <Input id="reset-email" type="email" disabled={isSubmitting} {...form.register("email")} />
            {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Send reset code"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
