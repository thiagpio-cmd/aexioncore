import { z } from "zod";

const VALID_ROLES = ["VIEWER", "SDR", "CLOSER", "REVOPS", "MANAGER", "DIRECTOR", "ADMIN"] as const;
const VALID_WORKSPACES = ["SDR", "CLOSER", "MANAGER", "EXECUTIVE"] as const;

export const UserCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(255).trim(),
  email: z.string().email("Invalid email format").max(255).trim(),
  role: z.enum(VALID_ROLES),
  workspace: z.enum(VALID_WORKSPACES).optional().default("SDR"),
  teamId: z.string().min(1).nullable().optional(),
});

export const UserUpdateSchema = z.object({
  role: z.enum(VALID_ROLES).optional(),
  workspace: z.enum(VALID_WORKSPACES).optional(),
  isActive: z.boolean().optional(),
  teamId: z.string().min(1).nullable().optional(),
});

export const PasswordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(128),
});

export const NotificationPrefsSchema = z.object({
  notificationPrefs: z.record(z.string(), z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
  })),
});

export type UserCreate = z.infer<typeof UserCreateSchema>;
export type UserUpdate = z.infer<typeof UserUpdateSchema>;
