import { z } from "zod";

export const AccountCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  status: z.string().default("active"),
  companyId: z.string().min(1, "Company ID is required"),
});

export const AccountUpdateSchema = AccountCreateSchema.partial();

export const AccountQuerySchema = z.object({
  page: z.string().default("1").transform(Number),
  limit: z.string().default("10").transform(Number),
  search: z.string().optional(),
  status: z.string().optional(),
  sortBy: z.string().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type AccountCreate = z.infer<typeof AccountCreateSchema>;
export type AccountUpdate = z.infer<typeof AccountUpdateSchema>;
export type AccountQuery = z.infer<typeof AccountQuerySchema>;
