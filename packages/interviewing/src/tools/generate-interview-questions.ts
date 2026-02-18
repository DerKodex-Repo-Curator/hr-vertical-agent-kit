import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { callClaudeJSON, toolError, toolSuccess, formatError } from "@hr-kit/core";
import type { InterviewStage } from "../schemas.js";

interface Question {
  id: string;
  question: string;
  competency: string;
  question_type: "behavioral" | "situational" | "technical" | "cultural_fit";
  follow_up_probes: string[];
  what_good_looks_like: string;
  red_flags_to_watch: string[];
}

interface QuestionGuide {
  questions: Question[];
  interview_guide_intro: string;
  estimated_duration_minutes: number;
}

const SYSTEM = `You are an expert talent assessment specialist and certified interviewer. You design
structured, competency-based interview question guides that are legally compliant, free of bias,
and highly predictive of on-the-job performance.

Rules:
- Generate ONLY behavioral, situational, technical, or cultural_fit questions
- NEVER ask about age, family status, religion, nationality, disabilities, or any protected characteristic
- Each question must have: id (q-1, q-2, ...), question text, competency, question_type,
  follow_up_probes (2-3), what_good_looks_like, red_flags_to_watch (2-3)
- Tailor questions to the specific role and stage
- Behavioral: use STAR-eliciting language ("Tell me about a time...", "Describe a situation...")
- Technical: specific to skills and domain in the job description
- phone_screen: motivation, logistics, high-level fit
- technical: domain-specific skills and problem-solving
- behavioral/panel/final: competency depth and culture

Return a JSON object with EXACTLY these fields:
{
  "questions": [
    {
      "id": "q-1",
      "question": "<full question text>",
      "competency": "<competency name>",
      "question_type": "<behavioral|situational|technical|cultural_fit>",
      "follow_up_probes": ["<probe 1>", "<probe 2>"],
      "what_good_looks_like": "<description of an excellent answer>",
      "red_flags_to_watch": ["<red flag 1>", "<red flag 2>"]
    }
  ],
  "interview_guide_intro": "<2-3 sentence intro for the interviewer>",
  "estimated_duration_minutes": <number>
}`;

export async function handleGenerateInterviewQuestions(args: {
  job_description: string;
  candidate_resume?: string;
  interview_stage: InterviewStage;
  question_count: number;
  competencies: string[];
  include_follow_ups: boolean;
  avoid_topics?: string[];
}): Promise<CallToolResult> {
  try {
    const user = `## Job Description
${args.job_description}
${args.candidate_resume ? `\n## Candidate Resume (tailor questions to their background)\n${args.candidate_resume}` : ""}

## Parameters
Interview stage: ${args.interview_stage}
Number of questions: ${args.question_count}
Competencies to assess: ${args.competencies.join(", ")}
Include follow-up probes: ${args.include_follow_ups}
${args.avoid_topics && args.avoid_topics.length > 0 ? `Topics already covered (do not repeat): ${args.avoid_topics.join(", ")}` : ""}

Generate exactly ${args.question_count} questions.
${!args.include_follow_ups ? "Set follow_up_probes to [] for all questions." : ""}`;

    const result = await callClaudeJSON<QuestionGuide>(SYSTEM, user, 3000);
    return toolSuccess(result);
  } catch (err) {
    return toolError(formatError(err, "generate_interview_questions"));
  }
}
