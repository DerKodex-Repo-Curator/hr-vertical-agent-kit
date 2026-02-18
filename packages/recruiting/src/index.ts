import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { handleParseResume } from "./tools/parse-resume.js";
import { handleScoreCandidate } from "./tools/score-candidate.js";
import { handleGenerateJobDescription } from "./tools/generate-job-description.js";
import { handleDetectBias } from "./tools/detect-bias.js";
import { BiasCategory, EducationRequirement, Tone, ScoringRubricSchema, WeightsSchema } from "./schemas.js";

const server = new McpServer({
  name: "hr-recruiting",
  version: "0.1.0",
});

// ─── parse_resume ────────────────────────────────────────────────────────────
server.tool(
  "parse_resume",
  "Extract structured contact info, work history, education, and skills from raw resume text.",
  {
    resume_text: z.string().min(50).describe("Raw text content of the resume"),
    output_format: z
      .enum(["structured", "summary"])
      .default("structured")
      .describe("structured = full JSON; summary = one-line prose"),
  },
  async (args) => handleParseResume(args)
);

// ─── score_candidate ─────────────────────────────────────────────────────────
server.tool(
  "score_candidate",
  "Score a candidate against a job description rubric. Returns 0-100 score, breakdown by dimension, and a hire recommendation.",
  {
    candidate_profile: z
      .string()
      .describe("Resume text or structured candidate description"),
    job_description: z.string().describe("The full job description text"),
    scoring_rubric: ScoringRubricSchema.describe(
      "Scoring criteria: must-have skills, nice-to-have skills, min years, education level"
    ),
    weights: WeightsSchema.describe(
      "Optional relative weights for skills, experience, and education (must sum to ~1.0)"
    ),
  },
  async (args) =>
    handleScoreCandidate({
      ...args,
      scoring_rubric: args.scoring_rubric,
      weights: args.weights ?? undefined,
    })
);

// ─── generate_job_description ─────────────────────────────────────────────────
server.tool(
  "generate_job_description",
  "Generate a complete, bias-aware job description in Markdown from a role spec.",
  {
    role_title: z.string().describe("Official title for the role"),
    department: z.string().describe("Department or team name"),
    responsibilities: z
      .array(z.string())
      .min(3)
      .describe("Key responsibilities (3-10 bullet points)"),
    required_qualifications: z
      .array(z.string())
      .describe("Non-negotiable qualifications"),
    preferred_qualifications: z
      .array(z.string())
      .optional()
      .describe("Nice-to-have qualifications"),
    compensation_range: z
      .object({
        min: z.number().positive(),
        max: z.number().positive(),
        currency: z.string().default("USD"),
        period: z.enum(["hourly", "annual"]).default("annual"),
      })
      .optional()
      .describe("Optional salary/rate range"),
    tone: Tone.default("conversational").describe(
      "Writing tone: formal, conversational, or startup"
    ),
    include_dei_statement: z
      .boolean()
      .default(true)
      .describe("Append an equal-opportunity statement"),
  },
  async (args) =>
    handleGenerateJobDescription({
      ...args,
      tone: args.tone,
      preferred_qualifications: args.preferred_qualifications ?? undefined,
      compensation_range: args.compensation_range ?? undefined,
    })
);

// ─── detect_bias ─────────────────────────────────────────────────────────────
server.tool(
  "detect_bias",
  "Scan a job description or evaluation text for biased language. Returns findings with severity, explanation, and suggested rewrites.",
  {
    text: z.string().min(20).describe("The text to audit for bias"),
    bias_categories: z
      .array(BiasCategory)
      .default(["gender", "age", "race", "disability"])
      .describe("Categories of bias to check for"),
    severity_threshold: z
      .enum(["all", "moderate", "high"])
      .default("all")
      .describe("Minimum severity level to report"),
  },
  async (args) =>
    handleDetectBias({
      text: args.text,
      bias_categories: args.bias_categories,
      severity_threshold: args.severity_threshold,
    })
);

// ─── Start ────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("hr-recruiting MCP server started on stdio\n");
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal error: ${String(err)}\n`);
  process.exit(1);
});
