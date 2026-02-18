import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ResponseStyle, EmploymentType } from "../schemas.js";

interface PolicyKnowledgeEntry {
  keywords: string[];
  answer: string;
  related_policies: string[];
  requires_escalation: boolean;
}

const POLICY_KNOWLEDGE_BASE: PolicyKnowledgeEntry[] = [
  {
    keywords: ["pto", "vacation", "time off", "holiday", "leave", "days off"],
    answer:
      "PTO policies vary by company. Full-time employees typically accrue paid time off starting from their hire date. Common accrual rates are 15-20 days/year for new hires, increasing with tenure. All time-off requests should be submitted through your HR system and approved by your manager. Check your employee handbook for the specific accrual schedule and blackout periods.",
    related_policies: ["PTO & Leave Policy", "Holiday Schedule", "Employee Handbook Section 4"],
    requires_escalation: false,
  },
  {
    keywords: ["remote", "work from home", "wfh", "hybrid", "flexible", "telework"],
    answer:
      "Remote and hybrid work arrangements are typically outlined in your employment agreement and team-level norms. Core collaboration hours, required in-office days (for hybrid roles), and equipment policies should be clarified with your manager. Eligibility for remote work may depend on your role and department.",
    related_policies: ["Remote Work Policy", "Flexible Work Arrangement Guidelines"],
    requires_escalation: false,
  },
  {
    keywords: ["benefits", "health insurance", "medical", "dental", "vision", "401k", "retirement"],
    answer:
      "Benefits enrollment typically opens on your first day and closes within 30 days of your hire date (qualifying life event window). Log into the benefits portal to review available plans and make elections. For 401(k) enrollment, you can typically enroll at any time. Contact HR or your benefits broker for plan-specific questions.",
    related_policies: ["Benefits Guide", "401(k) Plan Summary", "Open Enrollment FAQ"],
    requires_escalation: false,
  },
  {
    keywords: ["expense", "reimbursement", "receipt", "travel", "mileage", "per diem"],
    answer:
      "Business expenses should be submitted within 30-60 days of incurrence (check your policy for the exact window). Use the company's expense management system with itemized receipts for any single purchase over the threshold amount. Manager approval is required before trip booking for most companies. Alcohol expenses are typically not reimbursable unless pre-approved.",
    related_policies: ["Travel & Expense Policy", "Corporate Card Policy"],
    requires_escalation: false,
  },
  {
    keywords: ["performance review", "review", "appraisal", "feedback cycle", "evaluation", "promotion"],
    answer:
      "Performance reviews are typically conducted on an annual or bi-annual basis, with mid-year check-ins. Your manager will schedule a formal review to discuss accomplishments, development areas, and goals. Promotion decisions are often tied to the review cycle and require manager sponsorship and often committee approval above a certain level.",
    related_policies: ["Performance Management Policy", "Promotion & Career Progression Guide"],
    requires_escalation: false,
  },
  {
    keywords: ["harassment", "discrimination", "hostile", "complaint", "report", "ethics", "misconduct"],
    answer:
      "Any concerns about harassment, discrimination, or misconduct should be reported immediately through your company's confidential Ethics Hotline or directly to HR. Retaliation against anyone who makes a good-faith report is strictly prohibited. All reports are taken seriously and investigated promptly.",
    related_policies: ["Anti-Harassment Policy", "Code of Conduct", "Ethics Hotline Information"],
    requires_escalation: true,
  },
  {
    keywords: ["parental leave", "maternity", "paternity", "family leave", "fmla", "baby"],
    answer:
      "Parental leave eligibility, duration, and pay vary significantly by company and jurisdiction. Under FMLA (US), eligible employees may take up to 12 weeks of unpaid, job-protected leave. Many companies offer paid parental leave on top of FMLA. Please contact HR directly for your specific entitlement — this is a highly personalized matter.",
    related_policies: ["Parental Leave Policy", "FMLA Notice"],
    requires_escalation: true,
  },
  {
    keywords: ["termination", "fired", "laid off", "severance", "exit", "offboarding"],
    answer:
      "Involuntary termination and severance policies are confidential and case-specific. If you have concerns about your employment status, please speak directly with your manager or HR. Severance eligibility and amounts depend on tenure, role level, and specific circumstances.",
    related_policies: ["Separation Policy"],
    requires_escalation: true,
  },
  {
    keywords: ["confidential", "nda", "intellectual property", "ip", "trade secret", "non-compete"],
    answer:
      "Your employment agreement likely includes confidentiality, NDA, and IP assignment clauses. Do not share proprietary information outside the company or use it for personal gain. If you have questions about what's covered, consult HR or Legal before taking any action.",
    related_policies: ["Confidentiality Agreement", "IP Policy", "Non-Disclosure Agreement"],
    requires_escalation: true,
  },
  {
    keywords: ["payroll", "paycheck", "pay stub", "direct deposit", "salary", "pay frequency"],
    answer:
      "Payroll is processed on a bi-weekly or semi-monthly schedule (confirm with HR for your specific pay dates). Set up direct deposit in the HR/payroll system on Day 1. Pay stubs are accessible through the payroll portal. Questions about deductions or discrepancies should go to Payroll directly.",
    related_policies: ["Payroll & Compensation Policy"],
    requires_escalation: false,
  },
];

const DISCLAIMER =
  "This response is provided for general informational purposes and reflects common HR practices. It is not legal advice. Company-specific policies supersede this guidance — always refer to your official employee handbook or consult HR for authoritative answers.";

function findAnswer(question: string, policyDocs: string[]): {
  entry: PolicyKnowledgeEntry | null;
  fromDocs: boolean;
  docContent: string;
} {
  const lower = question.toLowerCase();

  // Check provided policy docs first (RAG-lite: keyword search)
  for (const doc of policyDocs) {
    const docLower = doc.toLowerCase();
    const questionWords = lower.split(/\s+/).filter((w) => w.length > 4);
    const matches = questionWords.filter((w) => docLower.includes(w));
    if (matches.length >= 3) {
      const sentences = doc.split(/[.!?]+/).filter((s) =>
        questionWords.some((w) => s.toLowerCase().includes(w))
      );
      return { entry: null, fromDocs: true, docContent: sentences.slice(0, 3).join(". ") };
    }
  }

  // Fall back to knowledge base
  const match = POLICY_KNOWLEDGE_BASE.find((entry) =>
    entry.keywords.some((k) => lower.includes(k))
  );
  return { entry: match ?? null, fromDocs: false, docContent: "" };
}

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
  const policyDocs = args.policy_documents ?? [];
  const { entry, fromDocs, docContent } = findAnswer(args.question, policyDocs);

  let answer: string;
  let confidence: "high" | "medium" | "low";
  let escalationFlag = false;
  let escalationReason: string | undefined;
  let sourcesCited: string[];
  let relatedPolicies: string[];

  if (fromDocs && docContent) {
    answer = docContent;
    confidence = "high";
    sourcesCited = ["Provided policy documents"];
    relatedPolicies = [];
  } else if (entry) {
    answer = entry.answer;
    if (args.employee_context) {
      const { tenure_months, employment_type, location_state_or_country } = args.employee_context;
      if (tenure_months < 3) {
        answer += ` Note: As a new employee (${tenure_months} months tenure), some benefits may require a waiting period — confirm with HR.`;
      }
      if (employment_type === "contractor") {
        answer += ` As a contractor, standard employee benefits and policies may not apply to you. Refer to your contract and consult with HR about contractor-specific guidelines.`;
      }
      if (["CA", "NY", "MA", "WA", "OR"].includes(location_state_or_country.toUpperCase())) {
        answer += ` Your location (${location_state_or_country}) may have additional state-level protections or requirements — consult HR for jurisdiction-specific guidance.`;
      }
    }
    confidence = entry.requires_escalation ? "medium" : "high";
    escalationFlag = entry.requires_escalation && args.escalate_if_uncertain;
    escalationReason = entry.requires_escalation ? "This topic involves sensitive, case-specific, or legally significant matters that require direct HR consultation." : undefined;
    sourcesCited = ["HR Policy Knowledge Base"];
    relatedPolicies = entry.related_policies;
  } else {
    answer =
      "I don't have a specific answer to that question in the available policy information. " +
      "Please contact HR directly for an accurate and authoritative response.";
    confidence = "low";
    escalationFlag = args.escalate_if_uncertain;
    escalationReason = "Question falls outside the scope of the available policy knowledge base.";
    sourcesCited = [];
    relatedPolicies = [];
  }

  // Format by response style
  if (args.response_style === "bullet_points" && answer.includes(".")) {
    const sentences = answer.split(". ").filter(Boolean);
    answer = sentences.map((s) => `• ${s.trim()}`).join("\n");
  }

  const result: {
    answer: string;
    confidence: "high" | "medium" | "low";
    sources_cited: string[];
    escalation_flag: boolean;
    escalation_reason?: string;
    related_policies: string[];
    disclaimer: string;
  } = {
    answer,
    confidence,
    sources_cited: sourcesCited,
    escalation_flag: escalationFlag,
    related_policies: relatedPolicies,
    disclaimer: DISCLAIMER,
  };

  if (escalationReason) {
    result.escalation_reason = escalationReason;
  }

  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}
