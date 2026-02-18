import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { callClaudeJSON, toolError, toolSuccess, formatError } from "@hr-kit/core";

type Recommendation = "hire" | "no_hire" | "strong_hire" | "needs_more_info";

interface StructuredFeedback {
  summary: string;
  strengths: string[];
  development_areas: string[];
  competency_scores: Record<string, number>;
  overall_recommendation: string;
  rationale: string;
}

interface FeedbackResult {
  structured_feedback: StructuredFeedback;
  candidate_facing_version: string | null;
  calibration_notes: string;
}

const SYSTEM = `You are a talent operations specialist who transforms raw interviewer notes into
structured, fair, legally defensible hiring feedback.

Rules:
- Only reference job-relevant competency observations — never mention protected characteristics
- Use behavioral, evidence-based language ("Candidate described a situation where...")
- If notes contain references to age, gender, ethnicity, family, religion, or disability, omit
  them entirely and flag in calibration_notes that non-job-relevant content was found
- Candidate-facing version must be warm, professional, and legally safe (no internal deliberation,
  no scores, no comparison to other candidates)
- overall_recommendation should be one of: "Strong Hire", "Hire", "Needs More Information", "No Hire"

Return a JSON object with EXACTLY these fields:
{
  "structured_feedback": {
    "summary": "<2-3 sentence executive summary for the debrief>",
    "strengths": ["<specific behavioral strength 1>", "<strength 2>", "<strength 3>"],
    "development_areas": ["<concern 1>", "<concern 2>"],
    "competency_scores": {<pass through the scores_by_competency as-is>},
    "overall_recommendation": "<Strong Hire | Hire | Needs More Information | No Hire>",
    "rationale": "<2-3 sentence evidence-based rationale>"
  },
  "candidate_facing_version": "<safe message for candidate, or null if share_with_candidate=false>",
  "calibration_notes": "<notes for the hiring committee>"
}`;

export async function handleStructureFeedback(args: {
  candidate_name: string;
  role: string;
  interviewer_raw_notes: string;
  scores_by_competency: Record<string, number>;
  recommendation: Recommendation;
  share_with_candidate: boolean;
}): Promise<CallToolResult> {
  try {
    const scores = Object.values(args.scores_by_competency);
    const avg = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;

    const user = `## Candidate: ${args.candidate_name}
## Role: ${args.role}
## Interviewer Recommendation: ${args.recommendation}
## Average Competency Score: ${avg.toFixed(1)}/5

## Competency Scores
${Object.entries(args.scores_by_competency).map(([k, v]) => `- ${k}: ${v}/5`).join("\n")}

## Raw Interviewer Notes
${args.interviewer_raw_notes}

## Instructions
share_with_candidate: ${args.share_with_candidate}
If share_with_candidate is false, set candidate_facing_version to null.`;

    const result = await callClaudeJSON<FeedbackResult>(SYSTEM, user, 2500);
    return toolSuccess(result);
  } catch (err) {
    return toolError(formatError(err, "structure_feedback"));
  }
}
