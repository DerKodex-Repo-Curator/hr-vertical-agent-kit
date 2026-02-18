import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { callClaudeJSON, toolError, toolSuccess, formatError } from "@hr-kit/core";
import type { Tone } from "../schemas.js";

interface JDResult {
  title: string;
  full_description: string;
  character_count: number;
  bias_warnings: string[];
  sections: {
    about_role: string;
    responsibilities: string;
    qualifications: string;
    compensation: string | null;
    dei_statement: string | null;
  };
}

const SYSTEM = `You are an expert HR copywriter specializing in inclusive, compelling job descriptions.
You write in plain language, avoid jargon, and proactively flag any language that could be biased or exclusionary.

Tone guide:
- formal: professional, structured, third-person ("The successful candidate will...")
- conversational: warm, direct, second-person ("You will work with...")
- startup: energetic, informal, bold ("We're building X and need someone who...")

Return a JSON object with EXACTLY these fields:
{
  "title": "<role title>",
  "full_description": "<complete job description in Markdown>",
  "character_count": <number>,
  "bias_warnings": ["<any potentially biased or exclusionary phrases detected>"],
  "sections": {
    "about_role": "<intro paragraph>",
    "responsibilities": "<markdown bullet list>",
    "qualifications": "<markdown bullet list>",
    "compensation": "<compensation string, or null if not provided>",
    "dei_statement": "<equal opportunity statement, or null if not requested>"
  }
}

The full_description should be complete, polished, and publication-ready Markdown.
bias_warnings should be [] if no issues were detected.`;

export async function handleGenerateJobDescription(args: {
  role_title: string;
  department: string;
  responsibilities: string[];
  required_qualifications: string[];
  preferred_qualifications?: string[];
  compensation_range?: {
    min: number;
    max: number;
    currency: string;
    period: "hourly" | "annual";
  };
  tone: Tone;
  include_dei_statement: boolean;
}): Promise<CallToolResult> {
  try {
    const comp = args.compensation_range
      ? `${args.compensation_range.currency} ${args.compensation_range.min.toLocaleString()}-${args.compensation_range.max.toLocaleString()} ${args.compensation_range.period === "annual" ? "per year" : "per hour"}`
      : null;

    const user = `## Role Spec
Title: ${args.role_title}
Department: ${args.department}
Tone: ${args.tone}
Include DEI statement: ${args.include_dei_statement}
${comp ? `Compensation: ${comp}` : "Compensation: not specified"}

## Responsibilities
${args.responsibilities.map((r) => `- ${r}`).join("\n")}

## Required Qualifications
${args.required_qualifications.map((q) => `- ${q}`).join("\n")}
${
  args.preferred_qualifications && args.preferred_qualifications.length > 0
    ? `\n## Preferred Qualifications\n${args.preferred_qualifications.map((q) => `- ${q}`).join("\n")}`
    : ""
}`;

    const result = await callClaudeJSON<JDResult>(SYSTEM, user, 3000);
    result.character_count = result.full_description.length;
    return toolSuccess(result);
  } catch (err) {
    return toolError(formatError(err, "generate_job_description"));
  }
}
