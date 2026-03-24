import { z } from "zod";

export const ContactCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  title: z.string().optional(),
  companyId: z.string().min(1, "Company ID is required"),
  isChampion: z.boolean().default(false),
  isDecisionMaker: z.boolean().default(false),
});

export const ContactUpdateSchema = ContactCreateSchema.partial();

export const ContactQuerySchema = z.object({
  page: z.string().default("1").transform(Number),
  limit: z.string().default("10").transform(Number),
  search: z.string().optional(),
  companyId: z.string().optional(),
  sortBy: z.string().default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});
