import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { handleGenerateInterviewQuestions } from "./tools/generate-interview-questions.js";
import { handleEvaluateResponse } from "./tools/evaluate-response.js";
import { handleStructureFeedback } from "./tools/structure-feedback.js";
import { handleCheckIllegalQuestions } from "./tools/check-illegal-questions.js";
import { InterviewStage, Jurisdiction } from "./schemas.js";

const server = new McpServer({
  name: "hr-interviewing",
  version: "0.1.0",
});

// ─── generate_interview_questions ─────────────────────────────────────────────
server.tool(
  "generate_interview_questions",
  "Generate a structured interview question guide with follow-up probes, what-good-looks-like criteria, and red flags to watch.",
  {
    job_description: z.string().describe("Full job description text"),
    candidate_resume: z
      .string()
      .optional()
      .describe("Optional: candidate resume to tailor questions"),
    interview_stage: InterviewStage.describe(
      "Stage of the interview process: phone_screen, technical, behavioral, panel, or final"
    ),
    question_count: z
      .number()
      .int()
      .min(3)
      .max(20)
      .default(8)
      .describe("Number of questions to generate"),
    competencies: z
      .array(z.string())
      .describe(
        "Competencies to assess, e.g. ['leadership', 'communication', 'problem-solving']"
      ),
    include_follow_ups: z
      .boolean()
      .default(true)
      .describe("Include follow-up probe questions for each question"),
    avoid_topics: z
      .array(z.string())
      .optional()
      .describe("Topics already covered in prior interviews to avoid repeating"),
  },
  async (args) =>
    handleGenerateInterviewQuestions({
      ...args,
      candidate_resume: args.candidate_resume ?? undefined,
      avoid_topics: args.avoid_topics ?? undefined,
    })
);

// ─── evaluate_response ────────────────────────────────────────────────────────
server.tool(
  "evaluate_response",
  "Score a candidate's interview response using the STAR framework. Returns a 1-5 score, strengths, gaps, and debrief notes.",
  {
    question: z.string().describe("The interview question that was asked"),
    candidate_response: z
      .string()
      .describe("The candidate's verbatim or summarized response"),
    evaluation_criteria: z
      .array(z.string())
      .describe("Specific criteria to look for in the response"),
    interview_stage: InterviewStage.describe("Stage of the interview"),
    use_star_framework: z
      .boolean()
      .default(true)
      .describe(
        "Evaluate using STAR (Situation, Task, Action, Result) framework"
      ),
  },
  async (args) => handleEvaluateResponse(args)
);

// ─── structure_feedback ───────────────────────────────────────────────────────
server.tool(
  "structure_feedback",
  "Transform raw interviewer notes and competency scores into structured hiring feedback with recommendation rationale.",
  {
    candidate_name: z.string().describe("Full name of the candidate"),
    role: z.string().describe("Role title being interviewed for"),
    interviewer_raw_notes: z
      .string()
      .describe("Unstructured notes from the interviewer"),
    scores_by_competency: z
      .record(z.string(), z.number().min(1).max(5))
      .describe(
        "Competency scores, e.g. { 'leadership': 4, 'communication': 3 }"
      ),
    recommendation: z
      .enum(["hire", "no_hire", "strong_hire", "needs_more_info"])
      .describe("Hiring recommendation"),
    share_with_candidate: z
      .boolean()
      .default(false)
      .describe(
        "Generate a candidate-safe version of the feedback (strips internal notes)"
      ),
  },
  async (args) =>
    handleStructureFeedback({
      ...args,
      recommendation: args.recommendation,
    })
);

// ─── check_illegal_questions ──────────────────────────────────────────────────
server.tool(
  "check_illegal_questions",
  "Audit a list of interview questions for legal compliance. Flags questions that may violate employment law and provides compliant alternatives.",
  {
    questions: z
      .array(z.string())
      .min(1)
      .describe("List of interview questions to audit"),
    jurisdiction: Jurisdiction.default("US").describe(
      "Legal jurisdiction: US, UK, EU, CA (Canada), or AU (Australia)"
    ),
    context: z
      .string()
      .optional()
      .describe("Optional context, e.g. 'panel interview for a security-cleared role'"),
  },
  async (args) =>
    handleCheckIllegalQuestions({
      ...args,
      context: args.context ?? undefined,
    })
);

// ─── Start ────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("hr-interviewing MCP server started on stdio\n");
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal error: ${String(err)}\n`);
  process.exit(1);
});
