import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { BiasCategory } from "../schemas.js";

type Severity = "low" | "moderate" | "high";

interface BiasEntry {
  phrase: string;
  category: BiasCategory;
  severity: Severity;
  explanation: string;
  suggested_rewrite: string;
}

const BIAS_DICT: BiasEntry[] = [
  // Gender — high
  { phrase: "ninja", category: "gender", severity: "moderate", explanation: "Coded masculine language that may discourage women from applying.", suggested_rewrite: "expert" },
  { phrase: "rockstar", category: "gender", severity: "moderate", explanation: "Coded masculine language that may discourage women from applying.", suggested_rewrite: "high performer" },
  { phrase: "guru", category: "gender", severity: "low", explanation: "Coded masculine language.", suggested_rewrite: "specialist" },
  { phrase: "wizard", category: "gender", severity: "low", explanation: "Coded masculine language.", suggested_rewrite: "expert" },
  { phrase: "dominate", category: "gender", severity: "moderate", explanation: "Aggressive masculine-coded verb.", suggested_rewrite: "lead" },
  { phrase: "aggressive", category: "gender", severity: "moderate", explanation: "Masculine-coded trait that may deter women applicants.", suggested_rewrite: "proactive" },
  { phrase: "he will", category: "gender", severity: "high", explanation: "Assumes the role will be filled by a man.", suggested_rewrite: "they will" },
  { phrase: "he or she", category: "gender", severity: "low", explanation: "Binary gendered language; excludes non-binary candidates.", suggested_rewrite: "they" },
  { phrase: "manpower", category: "gender", severity: "high", explanation: "Gendered term.", suggested_rewrite: "workforce" },
  { phrase: "mankind", category: "gender", severity: "high", explanation: "Gendered term.", suggested_rewrite: "humankind" },
  { phrase: "chairman", category: "gender", severity: "high", explanation: "Gendered title.", suggested_rewrite: "chairperson" },
  { phrase: "salesman", category: "gender", severity: "high", explanation: "Gendered title.", suggested_rewrite: "sales representative" },
  { phrase: "handshake", category: "gender", severity: "moderate", explanation: "Ableist and implicitly gendered; excludes people with disabilities.", suggested_rewrite: "professional manner" },
  { phrase: "strong handshake", category: "gender", severity: "high", explanation: "Ableist and implicitly gendered.", suggested_rewrite: "professional presence" },

  // Age — high
  { phrase: "digital native", category: "age", severity: "high", explanation: "Implies a preference for younger candidates (age discrimination).", suggested_rewrite: "proficient with digital tools" },
  { phrase: "young", category: "age", severity: "high", explanation: "Direct age discrimination language.", suggested_rewrite: "motivated" },
  { phrase: "recent graduate", category: "age", severity: "moderate", explanation: "May implicitly exclude older candidates with equivalent skills.", suggested_rewrite: "entry-level" },
  { phrase: "energetic team", category: "age", severity: "low", explanation: "'Energetic' can code for younger workers.", suggested_rewrite: "dynamic team" },
  { phrase: "fresh ideas", category: "age", severity: "low", explanation: "Can imply preference for younger workers.", suggested_rewrite: "innovative ideas" },
  { phrase: "2–5 years experience", category: "age", severity: "low", explanation: "Experience caps may constitute age discrimination in some jurisdictions.", suggested_rewrite: "relevant experience in [field]" },
  { phrase: "5+ years but no more", category: "age", severity: "high", explanation: "Experience caps are a form of age discrimination.", suggested_rewrite: "substantial experience in [field]" },

  // Race — high
  { phrase: "culture fit", category: "race", severity: "moderate", explanation: "'Culture fit' language can mask racial bias; be specific about values instead.", suggested_rewrite: "values alignment" },
  { phrase: "native english speaker", category: "race", severity: "high", explanation: "National origin discrimination; focus on communication skills instead.", suggested_rewrite: "excellent written and verbal communication skills" },
  { phrase: "fluent english", category: "race", severity: "low", explanation: "Prefer specifying the required communication standard.", suggested_rewrite: "professional-level English proficiency" },

  // Disability — high
  { phrase: "able-bodied", category: "disability", severity: "high", explanation: "Excludes people with disabilities unless a bona fide job requirement.", suggested_rewrite: "physically capable of [specific requirement]" },
  { phrase: "must be able to lift", category: "disability", severity: "low", explanation: "Only include if it is a genuine job requirement; be specific about weight.", suggested_rewrite: "required to lift up to [X] lbs as part of job duties" },
  { phrase: "physically fit", category: "disability", severity: "high", explanation: "Vague physical requirement that may exclude disabled candidates unnecessarily.", suggested_rewrite: "able to perform the essential physical functions of the role" },

  // Socioeconomic
  { phrase: "elite university", category: "socioeconomic", severity: "high", explanation: "Preferring elite universities correlates with socioeconomic background, not skill.", suggested_rewrite: "accredited university" },
  { phrase: "ivy league", category: "socioeconomic", severity: "high", explanation: "Correlates with socioeconomic privilege, not job performance.", suggested_rewrite: "accredited four-year university" },
  { phrase: "unpaid internship", category: "socioeconomic", severity: "moderate", explanation: "May unlawfully exclude candidates who cannot afford unpaid work.", suggested_rewrite: "internship (compensated)" },
];

function severityToScore(s: Severity): number {
  return s === "high" ? 3 : s === "moderate" ? 2 : 1;
}

export async function handleDetectBias(args: {
  text: string;
  bias_categories: BiasCategory[];
  severity_threshold: "all" | "moderate" | "high";
}): Promise<CallToolResult> {
  const lower = args.text.toLowerCase();
  const minSeverityScore =
    args.severity_threshold === "high" ? 3 : args.severity_threshold === "moderate" ? 2 : 1;

  const findings = BIAS_DICT.filter((entry) => {
    if (!args.bias_categories.includes(entry.category)) return false;
    if (severityToScore(entry.severity) < minSeverityScore) return false;
    return lower.includes(entry.phrase.toLowerCase());
  });

  let cleanVersion = args.text;
  for (const f of findings) {
    const re = new RegExp(f.phrase, "gi");
    cleanVersion = cleanVersion.replace(re, f.suggested_rewrite);
  }

  const totalSeverityScore = findings.reduce((sum, f) => sum + severityToScore(f.severity), 0);
  const overallBiasScore = Math.min(10, Math.round((totalSeverityScore / Math.max(1, findings.length)) * (findings.length / 2)));

  const summary =
    findings.length === 0
      ? "No bias detected in the scanned categories."
      : `Found ${findings.length} instance(s) of potentially biased language across ${new Set(findings.map((f) => f.category)).size} category/categories. Overall bias score: ${overallBiasScore}/10.`;

  const result = {
    overall_bias_score: overallBiasScore,
    findings: findings.map((f) => ({
      phrase: f.phrase,
      category: f.category,
      severity: f.severity,
      explanation: f.explanation,
      suggested_rewrite: f.suggested_rewrite,
    })),
    clean_version: cleanVersion,
    summary,
  };

  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}
