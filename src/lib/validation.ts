import { z } from "zod";

// Shared field schemas so validation rules are defined once and reused across
// every route (and can back client-side checks too).
export const emailSchema = z.string().trim().email("Enter a valid email address.").max(200);

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(200, "Password is too long.")
  .refine((p) => /[a-zA-Z]/.test(p) && /[0-9]/.test(p), {
    message: "Password must include at least one letter and one number.",
  });

export const nameSchema = z.string().trim().min(1, "Name is required.").max(120);

export const registerSchema = z.object({
  householdName: z.string().trim().min(1, "Household name is required.").max(120),
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: passwordSchema,
});
