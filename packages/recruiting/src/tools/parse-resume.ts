import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

interface WorkEntry {
  company: string;
  title: string;
  start_date: string;
  end_date: string;
  bullet_points: string[];
}

interface EducationEntry {
  institution: string;
  degree: string;
  field: string;
  graduation_year: number | null;
}

interface ParsedResume {
  contact: {
    name: string;
    email: string;
    phone: string;
    location: string;
    linkedin: string;
  };
  summary: string;
  work_history: WorkEntry[];
  education: EducationEntry[];
  skills: {
    technical: string[];
    soft: string[];
    certifications: string[];
  };
  total_years_experience: number;
  parse_confidence: number;
}

const EMAIL_RE = /[\w+\-.]+@[a-z\d\-]+(?:\.[a-z\d\-]+)*\.[a-z]+/i;
const PHONE_RE = /(?:\+1\s?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/;
const LINKEDIN_RE = /linkedin\.com\/in\/([\w\-]+)/i;
const DATE_RANGE_RE =
  /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,2})[\s,]*\d{4}\s*[-–—to]+\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,2}[\s,]*\d{4}|Present|Current|Now)/gi;
const YEAR_RE = /\b(19|20)\d{2}\b/;

const SECTION_HEADERS = {
  experience: /^(?:EXPERIENCE|WORK EXPERIENCE|WORK HISTORY|EMPLOYMENT|PROFESSIONAL EXPERIENCE)/i,
  education: /^(?:EDUCATION|ACADEMIC|ACADEMICS|QUALIFICATIONS)/i,
  skills: /^(?:SKILLS|TECHNICAL SKILLS|CORE COMPETENCIES|COMPETENCIES|TECHNOLOGIES)/i,
  summary: /^(?:SUMMARY|PROFILE|OBJECTIVE|ABOUT|PROFESSIONAL SUMMARY)/i,
  certifications: /^(?:CERTIFICATIONS|CERTIFICATES|LICENSES|CREDENTIALS)/i,
};

const SOFT_SKILL_KEYWORDS = new Set([
  "leadership",
  "communication",
  "teamwork",
  "collaboration",
  "problem-solving",
  "critical thinking",
  "adaptability",
  "time management",
  "project management",
  "mentoring",
  "coaching",
  "presentation",
  "negotiation",
  "conflict resolution",
  "empathy",
  "creativity",
  "attention to detail",
  "organization",
]);

const CERT_KEYWORDS =
  /\b(?:AWS|GCP|Azure|PMP|CISSP|CPA|CFA|CMA|SHRM|PHR|SPHR|Certified|Certificate|Certification|License)\b/i;

function yearToDecimal(dateStr: string): number {
  const yearMatch = YEAR_RE.exec(dateStr);
  if (!yearMatch?.[0]) return new Date().getFullYear();
  const year = parseInt(yearMatch[0], 10);
  const monthMap: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  for (const [abbr, idx] of Object.entries(monthMap)) {
    if (dateStr.includes(abbr)) return year + idx / 12;
  }
  return year;
}

function calcYearsFromRanges(text: string): number {
  const ranges = text.matchAll(DATE_RANGE_RE);
  let totalMonths = 0;
  for (const match of ranges) {
    const parts = match[0].split(/[-–—to]+/i).map((s) => s.trim());
    if (parts.length < 2) continue;
    const start = yearToDecimal(parts[0] ?? "");
    const endRaw = parts[1] ?? "";
    const end = /present|current|now/i.test(endRaw)
      ? new Date().getFullYear() + new Date().getMonth() / 12
      : yearToDecimal(endRaw);
    totalMonths += Math.max(0, (end - start) * 12);
  }
  return Math.round(totalMonths / 12);
}

function splitIntoSections(
  lines: string[]
): Record<string, string[]> {
  const sections: Record<string, string[]> = {
    header: [],
    summary: [],
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    other: [],
  };
  let current = "header";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let matched = false;
    for (const [key, re] of Object.entries(SECTION_HEADERS)) {
      if (re.test(trimmed)) {
        current = key;
        matched = true;
        break;
      }
    }
    if (!matched) {
      (sections[current] ??= []).push(trimmed);
    }
  }
  return sections;
}

function parseWorkHistory(lines: string[]): WorkEntry[] {
  const entries: WorkEntry[] = [];
  let current: WorkEntry | null = null;

  for (const line of lines) {
    const dateMatch = DATE_RANGE_RE.exec(line);
    DATE_RANGE_RE.lastIndex = 0;

    if (dateMatch) {
      if (current) entries.push(current);
      const parts = dateMatch[0].split(/[-–—to]+/i).map((s) => s.trim());
      current = {
        company: line.replace(dateMatch[0], "").replace(/[|·•,]/g, "").trim(),
        title: "",
        start_date: parts[0] ?? "",
        end_date: parts[1] ?? "Present",
        bullet_points: [],
      };
    } else if (current && (line.startsWith("•") || line.startsWith("-") || line.startsWith("*"))) {
      current.bullet_points.push(line.replace(/^[•\-*]\s*/, "").trim());
    } else if (current && !current.title && line.length < 80) {
      if (current.company && !current.title) {
        current.title = line;
      } else if (!current.company) {
        current.company = line;
      }
    }
  }
  if (current) entries.push(current);
  return entries;
}

function parseEducation(lines: string[]): EducationEntry[] {
  const entries: EducationEntry[] = [];
  const degreeRe = /\b(?:BS|BA|MS|MA|MBA|PhD|JD|MD|BEng|MEng|Bachelor|Master|Doctor|Associate)\b/i;

  for (const line of lines) {
    const degreeMatch = degreeRe.exec(line);
    if (degreeMatch) {
      const yearMatch = YEAR_RE.exec(line);
      entries.push({
        institution: line.replace(degreeRe, "").replace(/[,|·]/g, "").trim().split(/\s{2,}/)[0] ?? "",
        degree: degreeMatch[0],
        field: "",
        graduation_year: yearMatch ? parseInt(yearMatch[0], 10) : null,
      });
    }
  }
  return entries;
}

function parseSkills(lines: string[]): { technical: string[]; soft: string[]; certifications: string[] } {
  const technical: string[] = [];
  const soft: string[] = [];
  const certifications: string[] = [];

  for (const line of lines) {
    const items = line.split(/[,;|·•]/);
    for (const item of items) {
      const clean = item.trim();
      if (!clean || clean.length > 40) continue;
      if (CERT_KEYWORDS.test(clean)) {
        certifications.push(clean);
      } else if (SOFT_SKILL_KEYWORDS.has(clean.toLowerCase())) {
        soft.push(clean);
      } else {
        technical.push(clean);
      }
    }
  }
  return { technical: [...new Set(technical)], soft: [...new Set(soft)], certifications: [...new Set(certifications)] };
}

export async function handleParseResume(args: {
  resume_text: string;
  output_format: "structured" | "summary";
}): Promise<CallToolResult> {
  const lines = args.resume_text.split("\n");
  const sections = splitIntoSections(lines);

  const headerText = (sections["header"] ?? []).join(" ");
  const name = lines.find((l) => l.trim().length > 0 && l.trim().length < 60)?.trim() ?? "";
  const emailMatch = EMAIL_RE.exec(args.resume_text);
  const phoneMatch = PHONE_RE.exec(args.resume_text);
  const linkedinMatch = LINKEDIN_RE.exec(args.resume_text);

  const workHistory = parseWorkHistory(sections["experience"] ?? []);
  const education = parseEducation(sections["education"] ?? []);
  const skills = parseSkills(sections["skills"] ?? []);
  const totalYears = calcYearsFromRanges(args.resume_text);

  let fieldsFound = 0;
  if (emailMatch) fieldsFound++;
  if (phoneMatch) fieldsFound++;
  if (workHistory.length > 0) fieldsFound += 2;
  if (education.length > 0) fieldsFound++;
  if (skills.technical.length > 0) fieldsFound++;
  const parseConfidence = Math.min(1, fieldsFound / 6);

  const result: ParsedResume = {
    contact: {
      name,
      email: emailMatch?.[0] ?? "",
      phone: phoneMatch?.[0] ?? "",
      location: headerText.replace(EMAIL_RE, "").replace(PHONE_RE, "").replace(LINKEDIN_RE, "").replace(name, "").trim().split(/\s{2,}/)[1] ?? "",
      linkedin: linkedinMatch ? `linkedin.com/in/${linkedinMatch[1] ?? ""}` : "",
    },
    summary: (sections["summary"] ?? []).join(" "),
    work_history: workHistory,
    education,
    skills,
    total_years_experience: totalYears,
    parse_confidence: parseConfidence,
  };

  if (args.output_format === "summary") {
    const summary =
      `${result.contact.name} — ${result.total_years_experience} years experience. ` +
      `Skills: ${result.skills.technical.slice(0, 5).join(", ")}. ` +
      `Most recent: ${workHistory[0]?.title ?? "unknown"} at ${workHistory[0]?.company ?? "unknown"}.`;
    return { content: [{ type: "text", text: summary }] };
  }

  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}
