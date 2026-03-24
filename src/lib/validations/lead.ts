import { z } from "zod";

export const LeadCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  title: z.string().optional(),
  source: z.string().default("web"),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "DISQUALIFIED"]).default("NEW"),
  temperature: z.enum(["COLD", "COOL", "WARM", "HOT"]).default("COLD"),
  fitScore: z.number().min(0).max(100).default(0),
  companyId: z.string().min(1, "Company ID is required"),
  contactId: z.string().optional(),
  ownerId: z.string().min(1, "Owner ID is required"),
});

export const LeadUpdateSchema = LeadCreateSchema.partial();

export const LeadQuerySchema = z.object({
  page: z.string().default("1").transform(Number),
  limit: z.string().default("10").transform(Number),
  search: z.string().optional(),
  status: z.string().optional(),
  temperature: z.string().optional(),
  sortBy: z.string().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type LeadCreate = z.infer<typeof LeadCreateSchema>;
export type LeadUpdate = z.infer<typeof LeadUpdateSchema>;
export type LeadQuery = z.infer<typeof LeadQuerySchema>;
