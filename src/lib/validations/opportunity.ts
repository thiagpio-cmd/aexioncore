import { z } from "zod";

export const OpportunityCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  value: z.number().min(0).default(0),
  stage: z.string().default("discovery"),
  stageId: z.string().optional(),
  accountId: z.string().min(1, "Account ID is required"),
  ownerId: z.string().min(1, "Owner ID is required"),
  ownerName: z.string().optional(),
  probability: z.number().min(0).max(100).default(0),
  expectedCloseDate: z.string().datetime().optional(),
});

export const OpportunityUpdateSchema = OpportunityCreateSchema.partial();

export const OpportunityQuerySchema = z.object({
  page: z.string().default("1").transform(Number),
  limit: z.string().default("10").transform(Number),
  search: z.string().optional(),
  stage: z.string().optional(),
  ownerId: z.string().optional(),
  accountId: z.string().optional(),
  sortBy: z.string().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
