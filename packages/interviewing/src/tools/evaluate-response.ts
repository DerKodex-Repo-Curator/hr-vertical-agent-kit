import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { InterviewStage } from "../schemas.js";

interface StarAnalysis {
  situation: string;
  task: string;
  action: string;
  result: string;
}

const SITUATION_KEYWORDS = ["when", "time when", "situation", "context", "background", "was working", "at my last", "at my previous", "back in", "while i was"];
const TASK_KEYWORDS = ["my job was", "my role was", "i needed to", "my responsibility", "i was asked to", "tasked with", "had to", "goal was", "objective was"];
const ACTION_KEYWORDS = ["i did", "i decided", "i implemented", "i created", "i built", "i led", "i worked", "i reached out", "i started", "i developed", "i wrote", "first i", "then i", "i then"];
const RESULT_KEYWORDS = ["result", "outcome", "ultimately", "as a result", "in the end", "we achieved", "it worked", "improved by", "reduced by", "increased by", "saved", "delivered", "successfully", "%", "percent"];

function extractStar(response: string): StarAnalysis {
  const lower = response.toLowerCase();
  const sentences = response.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);

  function findSentences(keywords: string[]): string {
    const matches = sentences.filter((s) => keywords.some((k) => s.toLowerCase().includes(k)));
    return matches.length > 0 ? matches.slice(0, 2).join(". ") : "not clearly articulated";
  }

  return {
    situation: findSentences(SITUATION_KEYWORDS),
    task: findSentences(TASK_KEYWORDS),
    action: findSentences(ACTION_KEYWORDS),
    result: RESULT_KEYWORDS.some((k) => lower.includes(k))
      ? findSentences(RESULT_KEYWORDS)
      : "no quantifiable result mentioned",
  };
}

function scoreStarCompleteness(star: StarAnalysis): number {
  let score = 0;
  if (star.situation !== "not clearly articulated") score += 1;
  if (star.task !== "not clearly articulated") score += 1;
  if (star.action !== "not clearly articulated") score += 1;
  if (star.result !== "no quantifiable result mentioned") score += 2;
  return score; // max 5
}

export async function handleEvaluateResponse(args: {
  question: string;
  candidate_response: string;
  evaluation_criteria: string[];
  interview_stage: InterviewStage;
  use_star_framework: boolean;
}): Promise<CallToolResult> {
  const wordCount = args.candidate_response.split(/\s+/).length;
  const lower = args.candidate_response.toLowerCase();

  let baseScore = 3; // neutral start
  const strengths: string[] = [];
  const gaps: string[] = [];

  // Length heuristic
  if (wordCount < 30) {
    gaps.push("Response is very brief — candidate may need prompting to elaborate.");
    baseScore = Math.max(1, baseScore - 1);
  } else if (wordCount > 400) {
    gaps.push("Response is lengthy; candidate may benefit from structured conciseness.");
  } else {
    strengths.push("Response length is appropriate.");
  }

  // STAR analysis
  let starAnalysis: StarAnalysis | null = null;
  if (args.use_star_framework) {
    starAnalysis = extractStar(args.candidate_response);
    const starScore = scoreStarCompleteness(starAnalysis);
    baseScore = Math.min(5, baseScore + Math.round((starScore - 3) * 0.5));

    if (starScore >= 4) strengths.push("Clear STAR structure with measurable result.");
    if (starScore <= 2) gaps.push("Missing key STAR elements — probe for specifics.");
    if (starAnalysis.result === "no quantifiable result mentioned") {
      gaps.push("No measurable outcome stated — ask 'what was the specific impact?'");
    }
  }

  // Criteria keyword check
  for (const criterion of args.evaluation_criteria) {
    if (lower.includes(criterion.toLowerCase())) {
      strengths.push(`Addressed evaluation criterion: "${criterion}"`);
    } else {
      gaps.push(`Did not address criterion: "${criterion}"`);
    }
  }

  // Specific language markers
  if (/\b(i|we)\b.*\b(led|drove|owned|delivered)\b/i.test(args.candidate_response)) {
    strengths.push("Shows ownership and accountability.");
  }
  if (/\b(team|colleagues|stakeholders)\b/i.test(args.candidate_response)) {
    strengths.push("Demonstrates collaborative mindset.");
  }
  if (/\b(\d+%|\d+ percent|doubled|tripled|halved)\b/i.test(args.candidate_response)) {
    strengths.push("Quantifies impact with specific metrics.");
    baseScore = Math.min(5, baseScore + 1);
  }

  const followUpRecommended = gaps.length > 2 || (starAnalysis?.result === "no quantifiable result mentioned");
  const suggestedFollowUp = followUpRecommended
    ? `Can you walk me through the specific, measurable outcome? What changed as a result of your actions?`
    : null;

  const notes = [
    `Word count: ${wordCount}.`,
    args.use_star_framework ? `STAR completeness: ${scoreStarCompleteness(starAnalysis!!)}/5.` : "",
    gaps.length > 0 ? `Areas to probe: ${gaps.slice(0, 2).join("; ")}.` : "Strong overall response.",
  ]
    .filter(Boolean)
    .join(" ");

  const result = {
    score: Math.max(1, Math.min(5, baseScore)),
    star_analysis: starAnalysis,
    strengths,
    gaps,
    follow_up_recommended: followUpRecommended,
    suggested_follow_up: suggestedFollowUp,
    notes_for_debrief: notes,
  };

  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}
