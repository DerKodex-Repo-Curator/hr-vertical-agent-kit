import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
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

function addDays(startDate: string, days: number): string {
  const d = new Date(startDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0] ?? startDate;
}

function getRemoteSetupTasks(tools: string[], day: number): Task[] {
  return [
    {
      day,
      activity: `Set up accounts for: ${tools.slice(0, 5).join(", ")}`,
      owner: "IT / Employee",
      duration_hours: 2,
      resources: ["IT setup guide", "Account provisioning ticket"],
    },
    {
      day,
      activity: "Video call with manager for role overview and 90-day expectations",
      owner: "Manager",
      duration_hours: 1,
      resources: ["Role description", "Team OKRs"],
    },
  ];
}

function getWeek1Tasks(args: {
  employeeName: string;
  roleTitle: string;
  department: string;
  managerName: string;
  workMode: WorkMode;
  tools: string[];
  level: ExperienceLevel;
  stakeholders: string[];
  startDate: string;
}): Task[] {
  const { managerName, workMode, tools, stakeholders } = args;

  const base: Task[] = [
    {
      day: 1,
      activity: workMode === "onsite" ? "Office tour, badge setup, desk assignment" : "Virtual office tour and platform access setup",
      owner: "HR / Office Manager",
      duration_hours: 1,
      resources: ["Facilities guide"],
    },
    ...getRemoteSetupTasks(tools, 1),
    {
      day: 1,
      activity: "Welcome lunch / virtual coffee with direct team",
      owner: "Team",
      duration_hours: 1,
      resources: [],
    },
    {
      day: 2,
      activity: "HR onboarding session: benefits, policies, payroll setup",
      owner: "HR",
      duration_hours: 2,
      resources: ["Employee handbook", "Benefits portal"],
    },
    {
      day: 2,
      activity: `1:1 with ${managerName}: priorities, communication preferences, team norms`,
      owner: managerName,
      duration_hours: 1,
      resources: ["30-60-90 plan draft"],
    },
    {
      day: 3,
      activity: "Meet key stakeholders and cross-functional partners",
      owner: "Manager",
      duration_hours: 2,
      resources: [],
    },
    {
      day: 3,
      activity: "Review existing team documentation, processes, and current roadmap",
      owner: "Employee",
      duration_hours: 2,
      resources: ["Team Confluence/Notion space", "Project tracker"],
    },
    {
      day: 4,
      activity: "Shadow team members on a current project",
      owner: "Assigned buddy",
      duration_hours: 3,
      resources: [],
    },
    {
      day: 5,
      activity: "End-of-week check-in with manager: first impressions, questions, next week focus",
      owner: managerName,
      duration_hours: 0.5,
      resources: [],
    },
  ];

  if (stakeholders.length > 0) {
    base.push({
      day: 4,
      activity: `Schedule intro calls with key stakeholders: ${stakeholders.slice(0, 3).join(", ")}`,
      owner: "Employee",
      duration_hours: 1.5,
      resources: [],
    });
  }

  return base;
}

function getWeek2Tasks(managerName: string, level: ExperienceLevel): Task[] {
  const tasks: Task[] = [
    {
      day: 8,
      activity: "Deep-dive into current projects and strategic priorities",
      owner: "Employee",
      duration_hours: 3,
      resources: ["Strategy docs", "OKR tracker"],
    },
    {
      day: 8,
      activity: "Complete all mandatory compliance and security trainings",
      owner: "Employee",
      duration_hours: 2,
      resources: ["LMS portal"],
    },
    {
      day: 9,
      activity: "Attend all relevant recurring team meetings",
      owner: "Employee",
      duration_hours: 2,
      resources: ["Meeting calendar"],
    },
    {
      day: 10,
      activity: "Take on first small, well-scoped task to build context",
      owner: "Employee + Buddy",
      duration_hours: 4,
      resources: ["Task tracker"],
    },
    {
      day: 12,
      activity: `Weekly 1:1 with ${managerName}: progress check and priority alignment`,
      owner: managerName,
      duration_hours: 0.5,
      resources: [],
    },
  ];

  if (level === "senior" || level === "executive") {
    tasks.push({
      day: 11,
      activity: "Review team structure, current headcount, and open positions (if applicable)",
      owner: "Employee + Manager",
      duration_hours: 1,
      resources: ["Org chart"],
    });
  }

  return tasks;
}

function getWeeks3And4Tasks(level: ExperienceLevel, managerName: string): Task[] {
  return [
    {
      day: 15,
      activity: "Own and deliver first independent contribution",
      owner: "Employee",
      duration_hours: 8,
      resources: [],
    },
    {
      day: 18,
      activity: "Present work or findings to team — build visibility",
      owner: "Employee",
      duration_hours: 1,
      resources: [],
    },
    {
      day: 21,
      activity: "Finalize and share 30-60-90 day plan with manager",
      owner: "Employee + Manager",
      duration_hours: 1,
      resources: ["30-60-90 plan template"],
    },
    {
      day: 22,
      activity: "30-day check-in: progress against goals, support needs, any blockers",
      owner: managerName,
      duration_hours: 1,
      resources: [],
    },
  ];
}

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
  const week1 = getWeek1Tasks({
    employeeName: args.employee_name,
    roleTitle: args.role_title,
    department: args.department,
    managerName: args.manager_name,
    workMode: args.remote_hybrid_onsite,
    tools: args.company_tools,
    level: args.prior_experience_level,
    stakeholders: args.key_stakeholders,
    startDate: args.start_date,
  });

  const week2 = getWeek2Tasks(args.manager_name, args.prior_experience_level);
  const week3_4 = getWeeks3And4Tasks(args.prior_experience_level, args.manager_name);

  const requiredTrainings = [
    { title: "Information Security & Data Privacy", deadline: addDays(args.start_date, 7), mandatory: true },
    { title: "Code of Conduct & Ethics", deadline: addDays(args.start_date, 7), mandatory: true },
    { title: "Anti-Harassment & Workplace Safety", deadline: addDays(args.start_date, 14), mandatory: true },
    { title: "Benefits & Compensation Overview", deadline: addDays(args.start_date, 5), mandatory: true },
  ];

  if (args.employment_type === "full_time") {
    requiredTrainings.push({ title: "ESPP / Equity Overview (if applicable)", deadline: addDays(args.start_date, 30), mandatory: false });
  }

  const buddyRec = args.team_size > 5
    ? `Assign a peer buddy from the ${args.department} team for the first 30 days — ideally someone in a similar role who joined within the last 12 months.`
    : `Given the small team size, ${args.manager_name} should serve as the primary onboarding guide with structured weekly check-ins.`;

  const successMetrics = [
    `Completed all mandatory trainings by Day 14`,
    `Delivered first independent contribution by Day 21`,
    `Established working relationships with all key stakeholders by Day 30`,
    `30-60-90 plan agreed with ${args.manager_name} by Day 21`,
    args.remote_hybrid_onsite === "remote"
      ? `Active participant in all team async communication channels by Day 5`
      : `Introduced to all immediate team members by Day 3`,
  ];

  const result = {
    onboarding_plan: {
      week_1: { theme: "Orientation & Connection", tasks: week1 },
      week_2: { theme: "Learning & Context Building", tasks: week2 },
      week_3_4: { theme: "First Contributions", tasks: week3_4 },
    },
    buddy_system_recommendation: buddyRec,
    required_trainings: requiredTrainings,
    success_metrics: successMetrics,
  };

  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}
