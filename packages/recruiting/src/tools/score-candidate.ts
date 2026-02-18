import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ScoringRubric } from "../schemas.js";

const EDU_LEVELS: Record<string, number> = {
  none: 0,
  bachelors: 1,
  masters: 2,
  phd: 3,
};

const EDU_KEYWORDS: Record<string, string[]> = {
  phd: ["phd", "ph.d", "doctorate", "doctoral"],
  masters: ["master", "ms ", "m.s", "mba", "m.eng", "meng"],
  bachelors: ["bachelor", "bs ", "b.s", "ba ", "b.a", "b.eng", "beng", "undergraduate degree"],
};

function detectEducation(text: string): number {
  const lower = text.toLowerCase();
  for (const [level, keywords] of Object.entries(EDU_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) {
      return EDU_LEVELS[level] ?? 0;
    }
  }
  return 0;
}

function extractYears(text: string): number {
  const patterns = [
    /(\d+)\+?\s+years?\s+(?:of\s+)?(?:experience|exp)/i,
    /(\d+)\s+yrs?\s+(?:of\s+)?(?:experience|exp)/i,
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (m?.[1]) return parseInt(m[1], 10);
  }
  // Rough estimate: count date ranges
  const dateRangeRe = /\b(20\d{2}|19\d{2})\b/g;
  const years = [...text.matchAll(dateRangeRe)].map((m) => parseInt(m[1] ?? "0", 10));
  if (years.length >= 2) {
    const sorted = years.sort((a, b) => a - b);
    return (sorted[sorted.length - 1] ?? 0) - (sorted[0] ?? 0);
  }
  return 0;
}

function skillMatch(skill: string, text: string): boolean {
  return text.toLowerCase().includes(skill.toLowerCase());
}

type Recommendation = "strong_yes" | "yes" | "maybe" | "no";

function scoreToRecommendation(score: number, missingMustHaves: string[]): Recommendation {
  if (missingMustHaves.length > 0) return score >= 60 ? "maybe" : "no";
  if (score >= 85) return "strong_yes";
  if (score >= 70) return "yes";
  if (score >= 50) return "maybe";
  return "no";
}

export async function handleScoreCandidate(args: {
  candidate_profile: string;
  job_description: string;
  scoring_rubric: ScoringRubric;
  weights?: { skills: number; experience: number; education: number };
}): Promise<CallToolResult> {
  const text = `${args.candidate_profile} ${args.job_description}`;
  const candidateText = args.candidate_profile;

  const weights = args.weights ?? { skills: 0.4, experience: 0.4, education: 0.2 };

  // Skills scoring
  const mustHaves = args.scoring_rubric.must_have_skills;
  const niceToHaves = args.scoring_rubric.nice_to_have_skills;

  const matchedMustHaves = mustHaves.filter((s) => skillMatch(s, candidateText));
  const missingMustHaves = mustHaves.filter((s) => !skillMatch(s, candidateText));
  const matchedNiceToHaves = niceToHaves.filter((s) => skillMatch(s, candidateText));

  const mustHaveScore = mustHaves.length === 0 ? 100 : (matchedMustHaves.length / mustHaves.length) * 100;
  const niceToHaveBonus = niceToHaves.length === 0 ? 20 : (matchedNiceToHaves.length / niceToHaves.length) * 20;
  const skillsScore = Math.min(100, mustHaveScore * 0.8 + niceToHaveBonus);

  // Experience scoring
  const candidateYears = extractYears(candidateText);
  const minYears = args.scoring_rubric.min_years_experience;
  let experienceScore: number;
  if (minYears === 0) {
    experienceScore = 100;
  } else if (candidateYears >= minYears * 1.5) {
    experienceScore = 100;
  } else if (candidateYears >= minYears) {
    experienceScore = 80 + ((candidateYears - minYears) / (minYears * 0.5)) * 20;
  } else {
    experienceScore = Math.max(0, (candidateYears / minYears) * 80);
  }

  // Education scoring
  const candidateEduLevel = detectEducation(candidateText);
  const requiredLevel = EDU_LEVELS[args.scoring_rubric.education_requirement] ?? 0;
  let educationScore: number;
  if (requiredLevel === 0) {
    educationScore = 100;
  } else if (candidateEduLevel >= requiredLevel) {
    educationScore = 100;
  } else if (candidateEduLevel === requiredLevel - 1) {
    educationScore = 65;
  } else {
    educationScore = 30;
  }

  // Weighted total
  const overallScore = Math.round(
    skillsScore * weights.skills +
    experienceScore * weights.experience +
    educationScore * weights.education
  );

  const recommendation = scoreToRecommendation(overallScore, missingMustHaves);

  const reasoning =
    `Skills: ${matchedMustHaves.length}/${mustHaves.length} must-haves met` +
    (missingMustHaves.length > 0 ? ` (missing: ${missingMustHaves.join(", ")})` : "") +
    `. Experience: ${candidateYears} years vs ${minYears} required.` +
    ` Education: ${Object.keys(EDU_LEVELS).find((k) => EDU_LEVELS[k] === candidateEduLevel) ?? "unknown"} detected.`;

  const result = {
    overall_score: overallScore,
    breakdown: {
      skills_score: Math.round(skillsScore),
      experience_score: Math.round(experienceScore),
      education_score: Math.round(educationScore),
    },
    matched_must_haves: matchedMustHaves,
    missing_must_haves: missingMustHaves,
    matched_nice_to_haves: matchedNiceToHaves,
    recommendation,
    reasoning,
  };

  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}
