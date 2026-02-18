import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { handleCreateOnboardingPlan } from "./tools/create-onboarding-plan.js";
import { handleGenerateWelcomeEmail } from "./tools/generate-welcome-email.js";
import { handleAnswerPolicyQuestion } from "./tools/answer-policy-question.js";
import { handleCreate306090Plan } from "./tools/create-30-60-90-plan.js";
import {
  EmploymentType,
  WorkMode,
  ExperienceLevel,
  ResponseStyle,
  EmailTone,
} from "./schemas.js";

const server = new McpServer({
  name: "hr-onboarding",
  version: "0.1.0",
});

// ─── create_onboarding_plan ───────────────────────────────────────────────────
server.tool(
  "create_onboarding_plan",
  "Generate a structured 4-week onboarding plan for a new hire including daily tasks, required trainings, buddy system recommendation, and success metrics.",
  {
    employee_name: z.string().describe("Full name of the new hire"),
    role_title: z.string().describe("Job title of the new hire"),
    department: z.string().describe("Department the employee is joining"),
    start_date: z.string().describe("Start date in ISO 8601 format (YYYY-MM-DD)"),
    manager_name: z.string().describe("Name of the hiring manager"),
    employment_type: EmploymentType.describe("full_time, part_time, or contractor"),
    remote_hybrid_onsite: WorkMode.describe("Work arrangement: remote, hybrid, or onsite"),
    team_size: z.number().int().min(1).describe("Size of the immediate team"),
    prior_experience_level: ExperienceLevel.describe(
      "Experience level: entry, mid, senior, or executive"
    ),
    company_tools: z
      .array(z.string())
      .describe("List of tools the employee will use, e.g. ['Slack', 'Jira', 'Notion']"),
    key_stakeholders: z
      .array(z.string())
      .describe("Names of key stakeholders the employee should meet in Week 1"),
  },
  async (args) =>
    handleCreateOnboardingPlan({
      ...args,
      employment_type: args.employment_type,
      remote_hybrid_onsite: args.remote_hybrid_onsite,
      prior_experience_level: args.prior_experience_level,
    })
);

// ─── generate_welcome_email ───────────────────────────────────────────────────
server.tool(
  "generate_welcome_email",
  "Generate a personalized welcome email for a new hire with first-day logistics, team intro, tools setup, and culture notes.",
  {
    employee_name: z.string().describe("First name of the new hire"),
    role_title: z.string().describe("Job title"),
    start_date: z.string().describe("Start date in ISO 8601 format (YYYY-MM-DD)"),
    manager_name: z.string().describe("Name of the manager sending the email"),
    team_name: z.string().describe("Name of the team (e.g. 'Product Engineering')"),
    first_day_logistics: z
      .object({
        location_or_link: z.string().describe("Office address or video call link"),
        start_time: z.string().describe("Start time, e.g. '9:00 AM PT'"),
        parking_or_access_instructions: z
          .string()
          .optional()
          .describe("Parking, badge, or meeting-room access instructions"),
        dress_code: z.string().optional().describe("Dress code guidance"),
      })
      .describe("First-day logistics details"),
    include_sections: z
      .array(z.enum(["agenda", "tools_setup", "team_intro", "culture_note", "faq"]))
      .describe("Sections to include in the email"),
    tone: EmailTone.default("warm").describe("Email tone: warm, professional, or casual"),
    company_name: z.string().describe("Company name"),
  },
  async (args) =>
    handleGenerateWelcomeEmail({
      ...args,
      tone: args.tone,
      include_sections: args.include_sections,
      first_day_logistics: {
        ...args.first_day_logistics,
        parking_or_access_instructions: args.first_day_logistics.parking_or_access_instructions ?? undefined,
        dress_code: args.first_day_logistics.dress_code ?? undefined,
      },
    })
);

// ─── answer_policy_question ───────────────────────────────────────────────────
server.tool(
  "answer_policy_question",
  "Answer an employee's HR policy question using provided policy documents or the built-in knowledge base. Returns confidence level, escalation flag, and a mandatory disclaimer.",
  {
    question: z
      .string()
      .describe("The employee's policy question in plain English"),
    employee_context: z
      .object({
        role: z.string(),
        tenure_months: z.number().int().min(0),
        employment_type: EmploymentType,
        location_state_or_country: z.string().describe("State abbreviation or country code, e.g. 'CA', 'UK'"),
      })
      .optional()
      .describe("Optional context about the employee to personalize the response"),
    policy_documents: z
      .array(z.string())
      .optional()
      .describe("Optional policy document chunks to ground the answer in"),
    response_style: ResponseStyle.default("friendly").describe(
      "Response style: formal, friendly, or bullet_points"
    ),
    escalate_if_uncertain: z
      .boolean()
      .default(true)
      .describe("Flag for escalation to HR when confidence is low or topic is sensitive"),
  },
  async (args) =>
    handleAnswerPolicyQuestion({
      ...args,
      employee_context: args.employee_context
        ? { ...args.employee_context, employment_type: args.employee_context.employment_type }
        : undefined,
      policy_documents: args.policy_documents ?? undefined,
      response_style: args.response_style,
    })
);

// ─── create_30_60_90_plan ─────────────────────────────────────────────────────
server.tool(
  "create_30_60_90_plan",
  "Generate a personalized 30-60-90 day success plan for a new hire with phased goals, milestones, check-in schedule, and manager coaching notes.",
  {
    employee_name: z.string().describe("Full name of the employee"),
    role_title: z.string().describe("Job title"),
    department: z.string().describe("Department"),
    manager_name: z.string().describe("Manager's name"),
    company_goals: z
      .array(z.string())
      .describe("Top company-level goals the employee should contribute to"),
    team_priorities: z
      .array(z.string())
      .describe("Current team priorities and ongoing initiatives"),
    role_specific_objectives: z
      .array(z.string())
      .describe("Specific success criteria for this role"),
    prior_experience_level: ExperienceLevel.describe(
      "Experience level: entry, mid, senior, or executive"
    ),
    focus_areas: z
      .array(z.enum(["learning", "relationship_building", "process_improvement", "deliverables"]))
      .describe("Primary focus areas to emphasize in the plan"),
  },
  async (args) =>
    handleCreate306090Plan({
      ...args,
      prior_experience_level: args.prior_experience_level,
      focus_areas: args.focus_areas,
    })
);

// ─── Start ────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("hr-onboarding MCP server started on stdio\n");
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal error: ${String(err)}\n`);
  process.exit(1);
});
