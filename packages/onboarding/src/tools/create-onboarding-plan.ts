import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { callClaudeJSON, toolError, toolSuccess, formatError } from "@hr-kit/core";
import type { EmploymentType, WorkMode, ExperienceLevel } from "../schemas.js";

interface Task {
  day: number;
  activity: string;
  owner: string;
  duration_hours: number;
  resources: string[];
}

interface WeekPlan {
  theme: string;
  tasks: Task[];
}

interface OnboardingPlan {
  onboarding_plan: {
    week_1: WeekPlan;
    week_2: WeekPlan;
    week_3_4: WeekPlan;
  };
  buddy_system_recommendation: string;
  required_trainings: Array<{ title: string; deadline: string; mandatory: boolean }>;
  success_metrics: string[];
}

const SYSTEM = `You are an expert HR onboarding specialist. You design personalized, role-specific
onboarding plans that set new hires up for success in their first 30 days.

Create a structured 4-week onboarding plan tailored to the specific role, experience level,
and work mode (remote/hybrid/onsite). Include a mix of:
- Administrative setup (accounts, systems, payroll)
- Learning (product, processes, team dynamics)
- Connection (1:1s, team meetings, stakeholder intros)
- Early contributions (first tasks, deliverables)

Return a JSON object with EXACTLY these fields:
{
  "onboarding_plan": {
    "week_1": {
      "theme": "<week theme>",
      "tasks": [
        {
          "day": <1-5>,
          "activity": "<specific activity>",
          "owner": "<who runs this: HR | Manager | IT | Employee | Buddy>",
          "duration_hours": <number>,
          "resources": ["<link or doc name>"]
        }
      ]
    },
    "week_2": { "theme": "<theme>", "tasks": [...] },
    "week_3_4": { "theme": "<theme>", "tasks": [...] }
  },
  "buddy_system_recommendation": "<specific recommendation for buddy assignment>",
  "required_trainings": [
    { "title": "<training name>", "deadline": "<YYYY-MM-DD>", "mandatory": <true|false> }
  ],
  "success_metrics": ["<metric 1>", "<metric 2>", "<metric 3>"]
}

Personalize based on: role, department, experience level, and work mode.
Remote hires need more intentional virtual touchpoints than onsite hires.
Executive hires need more listening time and less task overload in Week 1.
Entry-level hires need more structure and psychological safety.`;

export async function handleCreateOnboardingPlan(args: {
  employee_name: string;
  role_title: string;
  department: string;
  start_date: string;
  manager_name: string;
  employment_type: EmploymentType;
  remote_hybrid_onsite: WorkMode;
  team_size: number;
  prior_experience_level: ExperienceLevel;
  company_tools: string[];
  key_stakeholders: string[];
}): Promise<CallToolResult> {
  try {
    const user = `## New Hire Details
Name: ${args.employee_name}
Role: ${args.role_title}
Department: ${args.department}
Start date: ${args.start_date}
Manager: ${args.manager_name}
Employment type: ${args.employment_type}
Work mode: ${args.remote_hybrid_onsite}
Team size: ${args.team_size}
Experience level: ${args.prior_experience_level}
Company tools to set up: ${args.company_tools.join(", ")}
Key stakeholders to meet: ${args.key_stakeholders.length > 0 ? args.key_stakeholders.join(", ") : "none specified"}

Create a tailored 4-week onboarding plan. Minimum 5 tasks per week section.`;

    const result = await callClaudeJSON<OnboardingPlan>(SYSTEM, user, 3000);
    return toolSuccess(result);
  } catch (err) {
    return toolError(formatError(err, "create_onboarding_plan"));
  }
}
