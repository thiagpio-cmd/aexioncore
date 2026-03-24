import { z } from "zod";

export const TaskCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  type: z.enum(["FOLLOW_UP", "CALL", "EMAIL", "MEETING", "APPROVAL", "OTHER"]).default("FOLLOW_UP"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).default("PENDING"),
  leadId: z.string().optional(),
  opportunityId: z.string().optional(),
  ownerId: z.string().min(1, "Owner ID is required"),
  dueDate: z.string().datetime().optional(),
});

export const TaskUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  type: z.enum(["FOLLOW_UP", "CALL", "EMAIL", "MEETING", "APPROVAL", "OTHER"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  leadId: z.string().optional(),
  opportunityId: z.string().optional(),
  ownerId: z.string().min(1).optional(),
  dueDate: z.string().datetime().optional(),
});

export const TaskQuerySchema = z.object({
  page: z.string().default("1").transform(Number),
  limit: z.string().default("20").transform(Number),
  search: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  type: z.string().optional(),
  ownerId: z.string().optional(),
  sortBy: z.string().default("dueDate"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});
