import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Tone } from "../schemas.js";

const DEI_STATEMENTS: Record<Tone, string> = {
  formal:
    "We are an equal opportunity employer. All qualified applicants will receive consideration for employment without regard to race, color, religion, sex, sexual orientation, gender identity, national origin, disability, or veteran status.",
  conversational:
    "We believe great work comes from diverse teams. We welcome applicants of all backgrounds, identities, and experiences — if you don't check every box but feel you'd thrive here, we encourage you to apply.",
  startup:
    "We're building a diverse team and actively encourage applications from people of all backgrounds. We don't care where you went to school — we care about what you can do and who you are.",
};

const INTRO_BY_TONE: Record<Tone, (role: string, dept: string) => string> = {
  formal: (role, dept) =>
    `The ${dept} department seeks a qualified ${role} to join our organization. The selected candidate will be responsible for the duties outlined below.`,
  conversational: (role, dept) =>
    `We're looking for a ${role} to join our ${dept} team! If you love doing great work and want to make an impact, read on.`,
  startup: (role, dept) =>
    `We're hiring a ${role} for our ${dept} team. We move fast, ship often, and want someone who's excited to build something meaningful.`,
};

const BIASED_TERMS_QUICK: string[] = [
  "ninja", "rockstar", "guru", "wizard", "aggressive",
  "dominant", "he will", "manpower", "digital native", "native english",
];

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
  const tone = args.tone;
  const intro = INTRO_BY_TONE[tone](args.role_title, args.department);

  const responsibilitiesSection = args.responsibilities
    .map((r) => `- ${r}`)
    .join("\n");

  const requiredSection = args.required_qualifications
    .map((q) => `- ${q}`)
    .join("\n");

  const preferredSection =
    args.preferred_qualifications && args.preferred_qualifications.length > 0
      ? args.preferred_qualifications.map((q) => `- ${q}`).join("\n")
      : null;

  let compensationSection = "";
  if (args.compensation_range) {
    const { min, max, currency, period } = args.compensation_range;
    const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 });
    compensationSection = `${fmt.format(min)} – ${fmt.format(max)} ${period === "annual" ? "per year" : "per hour"}`;
  }

  const deiStatement = args.include_dei_statement ? DEI_STATEMENTS[tone] : null;

  const sections = {
    about_role: intro,
    responsibilities: responsibilitiesSection,
    qualifications: requiredSection,
    compensation: compensationSection || null,
    dei_statement: deiStatement,
  };

  const fullDescription = [
    `# ${args.role_title}`,
    `**Department:** ${args.department}`,
    "",
    "## About the Role",
    intro,
    "",
    "## Responsibilities",
    responsibilitiesSection,
    "",
    "## Required Qualifications",
    requiredSection,
    preferredSection ? "\n## Preferred Qualifications\n" + preferredSection : "",
    compensationSection ? `\n## Compensation\n${compensationSection}` : "",
    deiStatement ? `\n## Equal Opportunity\n${deiStatement}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  // Quick bias check
  const allText = fullDescription.toLowerCase();
  const biasWarnings = BIASED_TERMS_QUICK.filter((t) => allText.includes(t.toLowerCase())).map(
    (t) => `Potentially biased term detected: "${t}" — consider reviewing with detect_bias tool`
  );

  const result = {
    title: args.role_title,
    full_description: fullDescription,
    character_count: fullDescription.length,
    bias_warnings: biasWarnings,
    sections,
  };

  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}
