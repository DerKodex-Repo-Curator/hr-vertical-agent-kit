import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { callClaudeJSON, toolError, toolSuccess, formatError } from "@hr-kit/core";
import type { InterviewStage } from "../schemas.js";

interface StarAnalysis {
  situation: string;
  task: string;
  action: string;
  result: string;
}

interface EvaluationResult {
  score: number;
  star_analysis: StarAnalysis | null;
  strengths: string[];
  gaps: string[];
  follow_up_recommended: boolean;
  suggested_follow_up: string | null;
  notes_for_debrief: string;
}

const SYSTEM = `You are an expert interviewer trained in behavioral interview assessment and the STAR
framework (Situation, Task, Action, Result). You evaluate candidate responses with nuance,
fairness, and depth — looking for quality of thinking, not just keyword presence.

STAR scoring guidance:
- Situation: Was context set clearly? (Not just "we had a problem" — what specifically?)
- Task: Was the candidate's specific responsibility defined? (Not just "I had to fix it")
- Action: Were concrete, personal actions described? ("we did X" is weak — what did THEY do?)
- Result: Was a measurable, specific outcome stated? (Numbers, percentages, timeframes preferred)

Overall score (1-5):
- 5: All STAR elements present, measurable result, insightful reflection, strong ownership
- 4: Strong STAR with minor gaps (result not quantified, or slight vagueness in action)
- 3: Partial STAR, decent content but missing one element or overly generic
- 2: Weak STAR, mostly vague, relies on "we" throughout, no clear result
- 1: Non-answer, off-topic, or too brief to evaluate

Return a JSON object with EXACTLY these fields:
{
  "score": <1-5>,
  "star_analysis": {
    "situation": "<extracted situation or 'Not articulated'>",
    "task": "<extracted task or 'Not articulated'>",
    "action": "<extracted personal actions or 'Not articulated'>",
    "result": "<extracted outcome or 'No measurable result mentioned'>"
  },
  "strengths": ["<specific strength 1>", "<strength 2>"],
  "gaps": ["<specific gap 1>", "<gap 2>"],
  "follow_up_recommended": <true|false>,
  "suggested_follow_up": "<follow-up question to probe gaps, or null>",
  "notes_for_debrief": "<2-3 sentence synthesis for the hiring debrief>"
}

If use_star_framework is false, set star_analysis to null and evaluate holistically.`;

export async function handleEvaluateResponse(args: {
  question: string;
  candidate_response: string;
  evaluation_criteria: string[];
  interview_stage: InterviewStage;
  use_star_framework: boolean;
}): Promise<CallToolResult> {
  try {
    const user = `## Interview Question
${args.question}

## Candidate Response
${args.candidate_response}

## Evaluation Parameters
Interview stage: ${args.interview_stage}
Use STAR framework: ${args.use_star_framework}
Evaluation criteria to check for: ${args.evaluation_criteria.join(", ")}

Evaluate this response fairly and specifically.`;

    const result = await callClaudeJSON<EvaluationResult>(SYSTEM, user);
    return toolSuccess(result);
  } catch (err) {
    return toolError(formatError(err, "evaluate_response"));
  }
}
