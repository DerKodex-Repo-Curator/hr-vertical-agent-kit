import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { callClaudeJSON, toolError, toolSuccess, formatError } from "@hr-kit/core";
import type { ResponseStyle, EmploymentType } from "../schemas.js";

interface PolicyAnswer {
  answer: string;
  confidence: "high" | "medium" | "low";
  sources_cited: string[];
  escalation_flag: boolean;
  escalation_reason?: string;
  related_policies: string[];
  disclaimer: string;
}

const DISCLAIMER =
  "This response is for general informational purposes only and reflects common HR practices. It is not legal advice. Your company's official employee handbook and HR team are the authoritative sources.";

const ESCALATION_TOPICS = [
  "termination", "severance", "lawsuit", "harassment", "discrimination",
  "misconduct", "complaint", "legal", "court", "EEOC", "parental leave",
  "FMLA", "disability accommodation", "ADA", "immigration", "visa",
  "arrest", "garnishment",
];

const SYSTEM = `You are a knowledgeable, friendly HR policy advisor. You help employees get clear,
accurate answers to their HR policy questions. You are warm and direct — not bureaucratic.

Rules:
- Answer using the provided policy documents first (if any). Quote relevant sections.
- If no policy documents are provided, give accurate general guidance on common HR practices
- Be honest about uncertainty — use confidence levels: "high" (clear policy answer),
  "medium" (general guidance, company policy may differ), "low" (need HR to confirm)
- Always escalate questions about: termination, harassment/discrimination, legal matters,
  parental leave specifics, disability accommodations, immigration, or garnishments
- Personalize if employee_context is provided (tenure, location, employment type)
- Response style: formal (professional prose), friendly (warm and direct), bullet_points (bulleted list)
- Always end with the standard disclaimer

Return a JSON object with EXACTLY these fields:
{
  "answer": "<the answer in the requested response_style>",
  "confidence": "<high | medium | low>",
  "sources_cited": ["<policy name or section if from provided docs, or 'General HR practices'>"],
  "escalation_flag": <true | false>,
  "escalation_reason": "<reason for escalation, or omit if not escalating>",
  "related_policies": ["<related policy names employees should also review>"],
  "disclaimer": "${DISCLAIMER}"
}`;

export async function handleAnswerPolicyQuestion(args: {
  question: string;
  employee_context?: {
    role: string;
    tenure_months: number;
    employment_type: EmploymentType;
    location_state_or_country: string;
  };
  policy_documents?: string[];
  response_style: ResponseStyle;
  escalate_if_uncertain: boolean;
}): Promise<CallToolResult> {
  try {
    const shouldEscalate = ESCALATION_TOPICS.some((topic) =>
      args.question.toLowerCase().includes(topic)
    );

    const user = `## Employee Question
${args.question}

${
  args.employee_context
    ? `## Employee Context
Role: ${args.employee_context.role}
Tenure: ${args.employee_context.tenure_months} months
Employment type: ${args.employee_context.employment_type}
Location: ${args.employee_context.location_state_or_country}`
    : "## Employee Context\nNot provided"
}

${
  args.policy_documents && args.policy_documents.length > 0
    ? `## Policy Documents (ground your answer in these)\n${args.policy_documents.join("\n\n---\n\n")}`
    : "## Policy Documents\nNone provided — use general HR best practices."
}

## Parameters
Response style: ${args.response_style}
Escalate if uncertain: ${args.escalate_if_uncertain}
${shouldEscalate ? "NOTE: This topic is flagged for automatic escalation." : ""}`;

    const result = await callClaudeJSON<PolicyAnswer>(SYSTEM, user, 1500);
    // Force escalation for sensitive topics regardless of LLM output
    if (shouldEscalate && args.escalate_if_uncertain) {
      result.escalation_flag = true;
      if (!result.escalation_reason) {
        result.escalation_reason =
          "This topic involves sensitive matters requiring direct HR consultation.";
      }
    }
    // Ensure disclaimer is always present
    result.disclaimer = DISCLAIMER;
    return toolSuccess(result);
  } catch (err) {
    return toolError(formatError(err, "answer_policy_question"));
  }
}
