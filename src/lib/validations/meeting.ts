import { z } from "zod";

export const MeetingCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  leadId: z.string().optional(),
  contactId: z.string().optional(),
  ownerId: z.string().min(1, "Owner ID is required"),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  location: z.string().optional(),
  attendees: z.string().optional(),
  notes: z.string().optional(),
});

export const MeetingUpdateSchema = MeetingCreateSchema.partial();

export const MeetingQuerySchema = z.object({
  page: z.string().default("1").transform(Number),
  limit: z.string().default("10").transform(Number),
  search: z.string().optional(),
  ownerId: z.string().optional(),
  sortBy: z.string().default("startTime"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});
