import { z } from "zod";

export const PASSWORD_REQUIREMENTS_MESSAGE =
  "Password must be at least 8 characters long and include at least one lowercase letter, one uppercase letter, one number, and one symbol.";

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const resetSchema = z
  .object({
    email: z.string().email("Enter a valid email"),
    otp: z.string().regex(/^\d{6}$/u, "OTP must be a 6-digit code"),
    newPassword: z
      .string()
      .regex(STRONG_PASSWORD_REGEX, PASSWORD_REQUIREMENTS_MESSAGE),
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
