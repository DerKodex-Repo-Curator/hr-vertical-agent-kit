import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { callClaudeJSON, toolError, toolSuccess, formatError } from "@hr-kit/core";
import type { ScoringRubric } from "../schemas.js";

interface ScoreResult {
  overall_score: number;
  breakdown: {
    skills_score: number;
    experience_score: number;
    education_score: number;
  };
  matched_must_haves: string[];
  missing_must_haves: string[];
  matched_nice_to_haves: string[];
  recommendation: "strong_yes" | "yes" | "maybe" | "no";
  reasoning: string;
}

const SYSTEM = `You are an expert, fair-minded talent acquisition specialist. Your job is to objectively
score candidates against a job description rubric. You assess skills with semantic understanding
(e.g. "Py" or "python3" count as Python; "k8s" counts as Kubernetes). You never factor in protected
characteristics. You give clear, evidence-based reasoning.

Return a JSON object with EXACTLY these fields:
{
  "overall_score": <number 0-100>,
  "breakdown": {
    "skills_score": <number 0-100>,
    "experience_score": <number 0-100>,
    "education_score": <number 0-100>
  },
  "matched_must_haves": [<skills from rubric that are clearly present>],
  "missing_must_haves": [<skills from rubric that are clearly absent>],
  "matched_nice_to_haves": [<nice-to-have skills that are present>],
  "recommendation": <"strong_yes" | "yes" | "maybe" | "no">,
  "reasoning": "<2-3 sentence plain-English justification>"
}

Scoring guide:
- skills_score: % of must-haves matched, boosted by nice-to-haves (max 20pt bonus)
- experience_score: how well candidate years meet minimum years required
- education_score: how well candidate education meets required level (none=100, below=30-65, meets=100, exceeds=100)
- overall_score: weighted sum per provided weights (default: skills 40%, experience 40%, education 20%)
- recommendation: strong_yes (>=85), yes (70-84), maybe (50-69, or missing must-haves), no (<50 or critical must-haves missing)`;

export async function handleScoreCandidate(args: {
  candidate_profile: string;
  job_description: string;
  scoring_rubric: ScoringRubric;
  weights?: { skills: number; experience: number; education: number };
}): Promise<CallToolResult> {
  try {
    const weights = args.weights ?? { skills: 0.4, experience: 0.4, education: 0.2 };
    const user = `## Candidate Profile
${args.candidate_profile}

## Job Description
${args.job_description}

## Scoring Rubric
Must-have skills: ${args.scoring_rubric.must_have_skills.join(", ")}
Nice-to-have skills: ${args.scoring_rubric.nice_to_have_skills.join(", ")}
Minimum years of experience: ${args.scoring_rubric.min_years_experience}
Education requirement: ${args.scoring_rubric.education_requirement}

## Weights
Skills: ${weights.skills * 100}%, Experience: ${weights.experience * 100}%, Education: ${weights.education * 100}%`;

    const result = await callClaudeJSON<ScoreResult>(SYSTEM, user);
    return toolSuccess(result);
  } catch (err) {
    return toolError(formatError(err, "score_candidate"));
  }
}
