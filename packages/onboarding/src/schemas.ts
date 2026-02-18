import { z } from "zod";

export const EmploymentType = z.enum(["full_time", "part_time", "contractor"]);
export const WorkMode = z.enum(["remote", "hybrid", "onsite"]);
export const ExperienceLevel = z.enum(["entry", "mid", "senior", "executive"]);
export const ResponseStyle = z.enum(["formal", "friendly", "bullet_points"]);
export const EmailTone = z.enum(["warm", "professional", "casual"]);

export type EmploymentType = z.infer<typeof EmploymentType>;
export type WorkMode = z.infer<typeof WorkMode>;
export type ExperienceLevel = z.infer<typeof ExperienceLevel>;
export type ResponseStyle = z.infer<typeof ResponseStyle>;
export type EmailTone = z.infer<typeof EmailTone>;
