import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { callClaudeJSON, toolError, toolSuccess, formatError } from "@hr-kit/core";
import type { ExperienceLevel } from "../schemas.js";

type FocusArea = "learning" | "relationship_building" | "process_improvement" | "deliverables";

interface Milestone {
  milestone: string;
  success_criteria: string;
  by_date: string;
}

interface PhasePlan {
  theme: string;
  goals: string[];
  milestones: Milestone[];
  key_relationships_to_build: string[];
  deliverables: string[];
}

interface Plan306090 {
  plan: {
    days_1_30: PhasePlan;
    days_31_60: PhasePlan;
    days_61_90: PhasePlan;
  };
  success_metrics: Record<string, string>;
  check_in_schedule: Array<{ week: number; agenda_items: string[] }>;
  manager_coaching_notes: string;
}

const SYSTEM = `You are an expert leadership coach and HR specialist. You create realistic, tailored
30-60-90 day plans that give new hires a clear path to productivity and help managers set fair expectations.

Phase philosophy:
- Days 1-30: Listen, learn, absorb. Build relationships before making recommendations.
- Days 31-60: Start contributing. Own small but meaningful pieces of work.
- Days 61-90: Drive impact. Operate independently. Begin shaping direction.

Calibrate for experience level:
- entry: more structure, more learning tasks, manager checks in frequently
- mid: balance of learning and doing, starts owning tasks by Day 21
- senior: listening period is shorter, expected to identify improvements early
- executive: significant listening period, focus on trust-building before changing anything

Return a JSON object with EXACTLY these fields:
{
  "plan": {
    "days_1_30": {
      "theme": "<phase theme>",
      "goals": ["<goal 1>", "<goal 2>", "<goal 3>"],
      "milestones": [
        {
          "milestone": "<milestone name>",
          "success_criteria": "<how you know it is done>",
          "by_date": "<relative date like 'Day 14' or 'Day 30'>"
        }
      ],
      "key_relationships_to_build": ["<person/team 1>", "<person/team 2>"],
      "deliverables": ["<deliverable 1>", "<deliverable 2>"]
    },
    "days_31_60": { <same structure> },
    "days_61_90": { <same structure> }
  },
  "success_metrics": {
    "<metric name>": "<how it is measured>"
  },
  "check_in_schedule": [
    { "week": <week number>, "agenda_items": ["<item 1>", "<item 2>"] }
  ],
  "manager_coaching_notes": "<3-5 sentences of guidance for the manager>"
}

check_in_schedule should have entries at weeks 1, 2, 4, 8, and 13.`;

export async function handleCreate306090Plan(args: {
  employee_name: string;
  role_title: string;
  department: string;
  manager_name: string;
  company_goals: string[];
  team_priorities: string[];
  role_specific_objectives: string[];
  prior_experience_level: ExperienceLevel;
  focus_areas: FocusArea[];
}): Promise<CallToolResult> {
  try {
    const user = `## New Hire
Name: ${args.employee_name}
Role: ${args.role_title}
Department: ${args.department}
Manager: ${args.manager_name}
Experience level: ${args.prior_experience_level}
Focus areas: ${args.focus_areas.join(", ")}

## Company Goals
${args.company_goals.map((g) => `- ${g}`).join("\n")}

## Team Priorities
${args.team_priorities.map((p) => `- ${p}`).join("\n")}

## Role-Specific Objectives
${args.role_specific_objectives.map((o) => `- ${o}`).join("\n")}

Create a realistic, tailored 30-60-90 day plan. Goals should connect to the company goals and role objectives.`;

    const result = await callClaudeJSON<Plan306090>(SYSTEM, user, 3000);
    return toolSuccess(result);
  } catch (err) {
    return toolError(formatError(err, "create_30_60_90_plan"));
  }
}
