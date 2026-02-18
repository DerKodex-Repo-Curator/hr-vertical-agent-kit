import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

type Recommendation = "hire" | "no_hire" | "strong_hire" | "needs_more_info";

const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  strong_hire: "Strong Hire",
  hire: "Hire",
  needs_more_info: "Needs Additional Information",
  no_hire: "No Hire",
};

const RECOMMENDATION_RATIONALE: Record<Recommendation, string> = {
  strong_hire:
    "Candidate demonstrated exceptional performance across all evaluated competencies with clear, quantified examples.",
  hire: "Candidate met or exceeded expectations on core competencies. Minor gaps are addressable through onboarding.",
  needs_more_info:
    "The interview raised questions that require a follow-up conversation before a decision can be made.",
  no_hire:
    "Candidate did not meet the bar on critical competencies required for success in this role.",
};

function averageScore(scores: Record<string, number>): number {
  const values = Object.values(scores);
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function extractStrengths(notes: string, scores: Record<string, number>): string[] {
  const strengths: string[] = [];
  const highScoring = Object.entries(scores)
    .filter(([, v]) => v >= 4)
    .map(([k]) => k);
  for (const comp of highScoring) {
    strengths.push(`Strong performance in ${comp}`);
  }
  if (/quantif|metric|result|impact/i.test(notes)) {
    strengths.push("Provided specific, quantifiable examples of impact");
  }
  if (/team|collaborat|partner/i.test(notes)) {
    strengths.push("Demonstrated collaborative working style");
  }
  return strengths.length > 0 ? strengths : ["No specific strengths identified in notes"];
}

function extractConcerns(notes: string, scores: Record<string, number>): string[] {
  const concerns: string[] = [];
  const lowScoring = Object.entries(scores)
    .filter(([, v]) => v <= 2)
    .map(([k]) => k);
  for (const comp of lowScoring) {
    concerns.push(`Below-bar performance in ${comp}`);
  }
  if (/vague|unclear|generic|didn't answer/i.test(notes)) {
    concerns.push("Responses lacked specificity or depth");
  }
  if (/avoid|deflect|blame/i.test(notes)) {
    concerns.push("Candidate appeared to avoid accountability in examples");
  }
  return concerns;
}

function candidateFacingVersion(
  candidateName: string,
  role: string,
  strengths: string[],
  concerns: string[],
  recommendation: Recommendation
): string {
  const prefix = recommendation === "strong_hire" || recommendation === "hire"
    ? `Thank you for interviewing for the ${role} role, ${candidateName}. We were impressed with your background and conversation.`
    : `Thank you for taking the time to interview for the ${role} role, ${candidateName}. We appreciated the opportunity to learn more about your experience.`;

  const strengthsSummary = strengths.length > 0
    ? `We were particularly impressed by your ${strengths[0]?.toLowerCase() ?? "experience"}.`
    : "";

  return `${prefix} ${strengthsSummary} Our team will be in touch with next steps.`.trim();
}

export async function handleStructureFeedback(args: {
  candidate_name: string;
  role: string;
  interviewer_raw_notes: string;
  scores_by_competency: Record<string, number>;
  recommendation: Recommendation;
  share_with_candidate: boolean;
}): Promise<CallToolResult> {
  const avg = averageScore(args.scores_by_competency);
  const strengths = extractStrengths(args.interviewer_raw_notes, args.scores_by_competency);
  const concerns = extractConcerns(args.interviewer_raw_notes, args.scores_by_competency);

  const summary = `${args.candidate_name} interviewed for ${args.role}. Average competency score: ${avg.toFixed(1)}/5. Recommendation: ${RECOMMENDATION_LABELS[args.recommendation]}.`;

  const structured = {
    summary,
    strengths,
    development_areas: concerns,
    competency_scores: args.scores_by_competency,
    overall_recommendation: RECOMMENDATION_LABELS[args.recommendation],
    rationale: RECOMMENDATION_RATIONALE[args.recommendation],
  };

  const calibrationNotes = `Average score: ${avg.toFixed(1)}. ` +
    (avg >= 4 ? "Calibrate against your strongest recent hires for this role." :
      avg >= 3 ? "Meets bar but review whether gaps are critical or coachable." :
        "Below bar — ensure the recommendation is not influenced by factors unrelated to job performance.");

  const result: {
    structured_feedback: typeof structured;
    candidate_facing_version?: string;
    calibration_notes: string;
  } = {
    structured_feedback: structured,
    calibration_notes: calibrationNotes,
  };

  if (args.share_with_candidate) {
    result.candidate_facing_version = candidateFacingVersion(
      args.candidate_name,
      args.role,
      strengths,
      concerns,
      args.recommendation
    );
  }

  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}
