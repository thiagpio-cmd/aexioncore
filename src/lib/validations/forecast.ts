import { z } from "zod";

export const ForecastCreateSchema = z.object({
  quarter: z.string().min(1).max(10),
  year: z.number().int().min(2020).max(2100),
  commit: z.number().min(0),
  bestCase: z.number().min(0),
  pipeline: z.number().min(0),
  target: z.number().min(0),
});

export type ForecastCreate = z.infer<typeof ForecastCreateSchema>;
