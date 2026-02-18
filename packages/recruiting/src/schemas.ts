import { z } from "zod";

export const BiasCategory = z.enum([
  "gender",
  "age",
  "race",
  "disability",
  "socioeconomic",
  "educational",
]);

export const EducationRequirement = z.enum([
  "none",
  "bachelors",
  "masters",
  "phd",
]);

export const Tone = z.enum(["formal", "conversational", "startup"]);

export const ScoringRubricSchema = z.object({
  must_have_skills: z.array(z.string()),
  nice_to_have_skills: z.array(z.string()),
  min_years_experience: z.number().int().min(0),
  education_requirement: EducationRequirement.default("none"),
});

export const WeightsSchema = z
  .object({
    skills: z.number().min(0).max(1).default(0.4),
    experience: z.number().min(0).max(1).default(0.4),
    education: z.number().min(0).max(1).default(0.2),
  })
  .optional();

export type BiasCategory = z.infer<typeof BiasCategory>;
export type EducationRequirement = z.infer<typeof EducationRequirement>;
export type Tone = z.infer<typeof Tone>;
export type ScoringRubric = z.infer<typeof ScoringRubricSchema>;
