import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { callClaudeJSON, toolError, toolSuccess, formatError } from "@hr-kit/core";
import type { EmailTone } from "../schemas.js";

type EmailSection = "agenda" | "tools_setup" | "team_intro" | "culture_note" | "faq";

interface WelcomeEmail {
  subject_line: string;
  email_body: string;
  plain_text_version: string;
  estimated_read_time_minutes: number;
}

const SYSTEM = `You are an expert corporate communications specialist who writes warm, personalized
welcome emails that make new hires feel genuinely excited and prepared.

Tone guide:
- warm: genuine, human, slightly informal. Opens with enthusiasm.
- professional: respectful, structured, formal. Clear and direct.
- casual: startup-y, relaxed, uses contractions freely. Energetic.

Sections to include when requested:
- agenda: first day schedule with times
- tools_setup: list of tools to set up before Day 1
- team_intro: brief note about the team they're joining
- culture_note: 2-3 sentences on company values/culture
- faq: 3-4 common Day 1 questions with short answers

Rules:
- Do NOT include salary or compensation information
- Keep it under 400 words — scannable, not a wall of text
- Always include first day logistics clearly
- End with the manager's name as the sender
- The email_body should be in Markdown

Return a JSON object with EXACTLY these fields:
{
  "subject_line": "<email subject>",
  "email_body": "<complete email in Markdown>",
  "plain_text_version": "<plain text version with no markdown>",
  "estimated_read_time_minutes": <number, typically 1-3>
}`;

export async function handleGenerateWelcomeEmail(args: {
  employee_name: string;
  role_title: string;
  start_date: string;
  manager_name: string;
  team_name: string;
  first_day_logistics: {
    location_or_link: string;
    start_time: string;
    parking_or_access_instructions?: string;
    dress_code?: string;
  };
  include_sections: EmailSection[];
  tone: EmailTone;
  company_name: string;
}): Promise<CallToolResult> {
  try {
    const logistics = [
      `Location/Link: ${args.first_day_logistics.location_or_link}`,
      `Start time: ${args.first_day_logistics.start_time}`,
      args.first_day_logistics.parking_or_access_instructions
        ? `Access: ${args.first_day_logistics.parking_or_access_instructions}`
        : null,
      args.first_day_logistics.dress_code
        ? `Dress code: ${args.first_day_logistics.dress_code}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const user = `## New Hire
Name: ${args.employee_name}
Role: ${args.role_title}
Start date: ${args.start_date}
Manager: ${args.manager_name}
Team: ${args.team_name}
Company: ${args.company_name}

## First Day Logistics
${logistics}

## Email Parameters
Tone: ${args.tone}
Sections to include: ${args.include_sections.join(", ")}

Write a personalized welcome email.`;

    const result = await callClaudeJSON<WelcomeEmail>(SYSTEM, user, 2000);
    return toolSuccess(result);
  } catch (err) {
    return toolError(formatError(err, "generate_welcome_email"));
  }
}
