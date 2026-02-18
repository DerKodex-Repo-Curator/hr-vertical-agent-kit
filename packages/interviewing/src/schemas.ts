import { z } from "zod";

export const InterviewStage = z.enum([
  "phone_screen",
  "technical",
  "behavioral",
  "panel",
  "final",
]);

export const QuestionType = z.enum([
  "behavioral",
  "situational",
  "technical",
  "cultural_fit",
]);

export const Jurisdiction = z.enum(["US", "UK", "EU", "CA", "AU"]);

export type InterviewStage = z.infer<typeof InterviewStage>;
export type QuestionType = z.infer<typeof QuestionType>;
export type Jurisdiction = z.infer<typeof Jurisdiction>;
