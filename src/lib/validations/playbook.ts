import { z } from "zod";

const PlaybookStepSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  resources: z.string().max(2000).optional(),
});

export const PlaybookCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  segment: z.string().max(100).optional(),
  stage: z.string().max(100).optional(),
  steps: z.array(PlaybookStepSchema).optional(),
});

export const PlaybookUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  segment: z.string().max(100).optional(),
  stage: z.string().max(100).optional(),
  steps: z.array(PlaybookStepSchema).optional(),
});

export type PlaybookCreate = z.infer<typeof PlaybookCreateSchema>;
export type PlaybookUpdate = z.infer<typeof PlaybookUpdateSchema>;
