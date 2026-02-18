import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
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

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0] ?? "";
}

function buildDay30Phase(
  roleTitle: string,
  goals: string[],
  priorities: string[],
  level: ExperienceLevel,
  focusAreas: FocusArea[]
): PhasePlan {
  const learningGoals = [
    "Understand the team's current projects, roadmap, and key metrics",
    "Complete all mandatory onboarding trainings",
    "Learn the tools, processes, and systems used by the team",
  ];
  const relGoals = [
    "Build a working relationship with direct team members",
    "Schedule 1:1 introduction meetings with key stakeholders",
    "Understand the manager's communication preferences and priorities",
  ];

  const goalSet: string[] = [];
  if (focusAreas.includes("learning")) goalSet.push(...learningGoals);
  if (focusAreas.includes("relationship_building")) goalSet.push(...relGoals);
  if (goals.length > 0) goalSet.push(`Align on immediate role priorities: ${goals[0] ?? ""}`);

  const milestones: Milestone[] = [
    {
      milestone: "Completed all onboarding requirements",
      success_criteria: "All mandatory trainings done; all accounts set up; employee handbook reviewed",
      by_date: addDays(14),
    },
    {
      milestone: "First contribution shipped",
      success_criteria: "At least one task/PR/deliverable completed and reviewed",
      by_date: addDays(21),
    },
    {
      milestone: "30-day check-in with manager",
      success_criteria: "Discussed progress, blockers, and confirmed priorities for Day 31-60",
      by_date: addDays(30),
    },
  ];

  return {
    theme: "Listen, Learn, Absorb",
    goals: goalSet.slice(0, 5),
    milestones,
    key_relationships_to_build: ["Direct manager", "Immediate teammates", "Key cross-functional partners", "Onboarding buddy"],
    deliverables: [
      "Draft 30-60-90 plan and share with manager",
      level !== "entry" ? "Identify 2-3 quick wins or improvement opportunities" : "Complete first assigned task successfully",
      "Write a 'what I've learned' doc to share with the team",
    ],
  };
}

function buildDay60Phase(
  roleTitle: string,
  priorities: string[],
  objectives: string[],
  level: ExperienceLevel,
  focusAreas: FocusArea[]
): PhasePlan {
  const goals = [
    "Begin contributing independently on core team projects",
    "Apply learnings from Day 30 to take on more ownership",
    priorities[0] ? `Drive progress on: ${priorities[0]}` : "Own a meaningful project workstream",
    focusAreas.includes("process_improvement") ? "Identify at least one process improvement opportunity" : null,
  ].filter((g): g is string => g !== null);

  const milestones: Milestone[] = [
    {
      milestone: "Independently completed a significant workstream",
      success_criteria: "Delivered project/task with minimal guidance; received positive feedback",
      by_date: addDays(50),
    },
    {
      milestone: "Established trust with key stakeholders",
      success_criteria: "Stakeholders actively include you in planning discussions",
      by_date: addDays(60),
    },
  ];

  if (focusAreas.includes("process_improvement")) {
    milestones.push({
      milestone: "Process improvement identified and proposed",
      success_criteria: "Documented a specific inefficiency with a proposed solution and presented to team",
      by_date: addDays(55),
    });
  }

  return {
    theme: "Contribute & Build Credibility",
    goals: goals.slice(0, 5),
    milestones,
    key_relationships_to_build: ["Senior leadership stakeholders", "Adjacent team leads", "Potential mentors within the org"],
    deliverables: [
      objectives[0] ? `Make meaningful progress on: ${objectives[0]}` : "Own and deliver a team-level initiative",
      "Share a team-visible update on your work",
      level === "senior" || level === "executive" ? "Present a strategic recommendation to leadership" : "Document your learnings and share with the team",
    ],
  };
}

function buildDay90Phase(
  roleTitle: string,
  companyGoals: string[],
  objectives: string[],
  level: ExperienceLevel,
  focusAreas: FocusArea[]
): PhasePlan {
  const goals = [
    "Operate as a fully effective member of the team",
    companyGoals[0] ? `Contribute to company goal: ${companyGoals[0]}` : "Drive outcomes aligned to company objectives",
    objectives[0] ? `Achieve role objective: ${objectives[0]}` : "Deliver measurable impact in core responsibilities",
    level === "senior" || level === "executive" ? "Begin mentoring or sponsoring junior teammates" : "Build expertise in one key area of the role",
    focusAreas.includes("deliverables") ? "Ship a flagship deliverable that creates lasting value" : null,
  ].filter((g): g is string => g !== null);

  const milestones: Milestone[] = [
    {
      milestone: "Full productivity reached",
      success_criteria: "Operating independently on all core responsibilities without requiring onboarding support",
      by_date: addDays(90),
    },
    {
      milestone: "Delivered on a company-level priority",
      success_criteria: `Progress measurable on: ${companyGoals[0] ?? "key company metric"}`,
      by_date: addDays(85),
    },
    {
      milestone: "90-day review with manager",
      success_criteria: "Formal review completed; development areas identified; H2 goals set",
      by_date: addDays(90),
    },
  ];

  return {
    theme: "Drive Impact & Own Your Role",
    goals: goals.slice(0, 5),
    milestones,
    key_relationships_to_build: level === "executive"
      ? ["C-suite sponsors", "Board members (if applicable)", "Key external partners"]
      : ["Senior ICs or managers in related functions", "External partners or customers"],
    deliverables: [
      `Demonstrate measurable impact on: ${objectives[0] ?? "core role responsibilities"}`,
      "Establish a rhythm of regular stakeholder communication",
      level === "senior" || level === "executive" ? "Propose a strategic initiative for the next quarter" : "Create documentation or tooling that helps the team",
    ],
  };
}

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
  const day30 = buildDay30Phase(
    args.role_title,
    args.company_goals,
    args.team_priorities,
    args.prior_experience_level,
    args.focus_areas
  );

  const day60 = buildDay60Phase(
    args.role_title,
    args.team_priorities,
    args.role_specific_objectives,
    args.prior_experience_level,
    args.focus_areas
  );

  const day90 = buildDay90Phase(
    args.role_title,
    args.company_goals,
    args.role_specific_objectives,
    args.prior_experience_level,
    args.focus_areas
  );

  const successMetrics: Record<string, string> = {
    "Onboarding completion": "100% of mandatory trainings completed by Day 14",
    "First contribution": "At least one meaningful deliverable shipped by Day 21",
    "Stakeholder trust": "Actively included in planning discussions by Day 60",
    "Full productivity": "Operating independently on all core responsibilities by Day 90",
    "Manager satisfaction": "Positive 90-day review with clear development plan for next quarter",
  };

  const checkInSchedule = [
    { week: 1, agenda_items: ["First impressions", "Tool and access setup", "Any blockers or questions"] },
    { week: 2, agenda_items: ["Initial observations", "Clarity on priorities", "Adjust onboarding plan if needed"] },
    { week: 4, agenda_items: ["30-day check-in", "Review early wins", "Confirm 60-day focus areas"] },
    { week: 8, agenda_items: ["60-day check-in", "Progress against milestones", "Confirm 90-day deliverables"] },
    { week: 13, agenda_items: ["90-day formal review", "Accomplishments vs. plan", "Set Q2 goals and development plan"] },
  ];

  const managerNotes = [
    `Provide ${args.employee_name} with context on team dynamics and unwritten norms in Week 1.`,
    `Be explicit about how success is measured in this role — don't make them guess.`,
    `Schedule weekly 1:1s for the first 90 days, then reassess frequency.`,
    args.prior_experience_level === "executive"
      ? `Give ${args.employee_name} space to form their own perspective before being directive.`
      : `Assign a peer buddy to accelerate cultural integration.`,
    `Flag any emerging performance concerns early — 90 days is the window to course-correct easily.`,
  ].join(" ");

  const result = {
    plan: {
      days_1_30: day30,
      days_31_60: day60,
      days_61_90: day90,
    },
    success_metrics: successMetrics,
    check_in_schedule: checkInSchedule,
    manager_coaching_notes: managerNotes,
  };

  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}
