import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { EmailTone } from "../schemas.js";

type EmailSection = "agenda" | "tools_setup" | "team_intro" | "culture_note" | "faq";

const GREETINGS: Record<EmailTone, (name: string) => string> = {
  warm: (name) => `Hi ${name},`,
  professional: (name) => `Dear ${name},`,
  casual: (name) => `Hey ${name}!`,
};

const OPENINGS: Record<EmailTone, (role: string, company: string) => string> = {
  warm: (role, company) =>
    `We are absolutely thrilled to have you joining us as ${role} at ${company}! Your first day is just around the corner and we can't wait to welcome you to the team.`,
  professional: (role, company) =>
    `On behalf of ${company}, I am pleased to welcome you to your new role as ${role}. We look forward to your contributions and hope you find this transition smooth and productive.`,
  casual: (role, company) =>
    `Welcome to ${company}! We're pumped you're joining as our new ${role} — it's going to be a great ride.`,
};

const CLOSINGS: Record<EmailTone, (manager: string) => string> = {
  warm: (manager) =>
    `We are so excited to have you on the team. Don't hesitate to reach out if you have any questions before your first day. See you soon!\n\nWarmly,\n${manager}`,
  professional: (manager) =>
    `Please do not hesitate to contact me with any questions prior to your start date. We look forward to welcoming you formally on your first day.\n\nBest regards,\n${manager}`,
  casual: (manager) =>
    `Any questions before day one? Just ping us. Can't wait to have you onboard!\n\nCheers,\n${manager}`,
};

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function buildAgendaSection(startTime: string, locationOrLink: string, workMode: string): string {
  return [
    "## Your First Day Agenda",
    "",
    `- **${startTime}** — ${workMode.includes("http") ? `Join us at: ${locationOrLink}` : `Meet us at: ${locationOrLink}`}`,
    "- **Morning** — Welcome, office/platform tour, and account setup",
    "- **Midday** — Team lunch (virtual or in-person)",
    "- **Afternoon** — 1:1 with your manager and team introductions",
    "",
  ].join("\n");
}

function buildToolsSection(tools: string[]): string {
  if (tools.length === 0) return "";
  return [
    "## Setting Up Your Tools",
    "",
    "You'll receive provisioning emails for the following tools. Get them set up before Day 1 if you can:",
    tools.map((t) => `- **${t}**`).join("\n"),
    "",
  ].join("\n");
}

function buildTeamIntroSection(teamName: string, managerName: string): string {
  return [
    "## Your Team",
    "",
    `You'll be joining the **${teamName}** team, reporting directly to **${managerName}**. Expect a warm welcome from the whole group — we've been looking forward to having you!`,
    "",
  ].join("\n");
}

function buildCultureSection(companyName: string, tone: EmailTone): string {
  const snippets: Record<EmailTone, string> = {
    warm: `At ${companyName}, we believe in open collaboration, continuous learning, and taking care of each other. Don't be shy — ask questions, share ideas, and bring your full self to work.`,
    professional: `${companyName} values excellence, integrity, and continuous improvement. We encourage open dialogue and a growth mindset across all levels of the organization.`,
    casual: `${companyName} is all about moving fast, learning constantly, and having fun while doing it. We're a no-ego crew — jump in, ask anything, and don't be afraid to challenge the status quo.`,
  };
  return ["## Our Culture", "", snippets[tone], ""].join("\n");
}

function buildFaqSection(): string {
  return [
    "## Frequently Asked Questions",
    "",
    "**What should I bring / have ready on Day 1?**",
    "Government-issued ID for identity verification, and a charged laptop if you have one.",
    "",
    "**Who do I contact if I have questions?**",
    "Reach out to your manager or HR directly — we're here to help.",
    "",
    "**When will I get my equipment?**",
    "IT will reach out prior to your start date. Flag any issues to HR immediately.",
    "",
  ].join("\n");
}

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
  const { tone, employee_name, role_title, start_date, manager_name, team_name, company_name, include_sections, first_day_logistics } = args;

  const formattedDate = formatDate(start_date);
  const greeting = GREETINGS[tone](employee_name);
  const opening = OPENINGS[tone](role_title, company_name);
  const closing = CLOSINGS[tone](manager_name);

  const logistics = [
    `**Start Date:** ${formattedDate}`,
    `**Start Time:** ${first_day_logistics.start_time}`,
    `**Location / Link:** ${first_day_logistics.location_or_link}`,
    first_day_logistics.parking_or_access_instructions
      ? `**Access:** ${first_day_logistics.parking_or_access_instructions}`
      : null,
    first_day_logistics.dress_code ? `**Dress Code:** ${first_day_logistics.dress_code}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const sections: string[] = [
    greeting,
    "",
    opening,
    "",
    "## First Day Details",
    "",
    logistics,
    "",
  ];

  if (include_sections.includes("agenda")) {
    sections.push(buildAgendaSection(first_day_logistics.start_time, first_day_logistics.location_or_link, first_day_logistics.location_or_link));
  }
  if (include_sections.includes("team_intro")) {
    sections.push(buildTeamIntroSection(team_name, manager_name));
  }
  if (include_sections.includes("tools_setup")) {
    sections.push(buildToolsSection([])); // Tools passed via onboarding plan
  }
  if (include_sections.includes("culture_note")) {
    sections.push(buildCultureSection(company_name, tone));
  }
  if (include_sections.includes("faq")) {
    sections.push(buildFaqSection());
  }

  sections.push(closing);

  const body = sections.join("\n");
  const plainText = body.replace(/#{1,6}\s*/g, "").replace(/\*\*/g, "").replace(/\*/g, "");
  const wordCount = plainText.split(/\s+/).length;
  const readMinutes = Math.ceil(wordCount / 200);

  const subject = tone === "professional"
    ? `Welcome to ${company_name} — Your First Day Details, ${formattedDate}`
    : `Welcome aboard, ${employee_name}! 🎉 Your start date details inside`;

  const result = {
    subject_line: subject,
    email_body: body,
    plain_text_version: plainText,
    estimated_read_time_minutes: readMinutes,
  };

  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}
