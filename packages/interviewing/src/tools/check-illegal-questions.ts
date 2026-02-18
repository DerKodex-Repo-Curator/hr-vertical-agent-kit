import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Jurisdiction } from "../schemas.js";

type RiskLevel = "none" | "low" | "medium" | "high" | "illegal";

interface QuestionRule {
  pattern: RegExp;
  risk: RiskLevel;
  category: string;
  legal_basis: string;
  issue: string;
  alternative: string;
  jurisdictions: Jurisdiction[];
}

const RULES: QuestionRule[] = [
  // Age
  {
    pattern: /how old are you|what.?s your age|when were you born|what year were you born|date of birth/i,
    risk: "illegal",
    category: "Age",
    legal_basis: "Age Discrimination in Employment Act (ADEA) — US; Equality Act 2010 — UK",
    issue: "Directly asks for age, enabling age-based discrimination.",
    alternative: "Are you 18 years of age or older?",
    jurisdictions: ["US", "UK", "CA", "AU", "EU"],
  },
  {
    pattern: /when did you graduate|what year did you graduate/i,
    risk: "medium",
    category: "Age",
    legal_basis: "ADEA (US) — graduation year can reveal age.",
    issue: "Graduation year can be used to infer age.",
    alternative: "Do you have a [degree type] in [field]?",
    jurisdictions: ["US"],
  },
  // Marital/family status
  {
    pattern: /are you married|do you have a (wife|husband|spouse|partner)|marital status/i,
    risk: "illegal",
    category: "Marital Status",
    legal_basis: "Title VII (US); Equality Act (UK); Human Rights Code (CA)",
    issue: "Marital status is a protected characteristic and irrelevant to job performance.",
    alternative: "Are you able to meet the travel requirements of this role?",
    jurisdictions: ["US", "UK", "CA", "AU", "EU"],
  },
  {
    pattern: /do you have (kids|children|family|a family)|are you pregnant|planning.?(family|baby|children)/i,
    risk: "illegal",
    category: "Family/Pregnancy Status",
    legal_basis: "Pregnancy Discrimination Act (US); Equality Act (UK)",
    issue: "Questions about children or pregnancy constitute discrimination.",
    alternative: "This role involves [travel/late hours]. Are you able to meet these requirements?",
    jurisdictions: ["US", "UK", "CA", "AU", "EU"],
  },
  // Religion
  {
    pattern: /what.?s your religion|are you (christian|muslim|jewish|hindu|buddhist)|what church|religious beliefs|do you attend (church|mosque|synagogue)/i,
    risk: "illegal",
    category: "Religion",
    legal_basis: "Title VII (US); Equality Act (UK)",
    issue: "Religious affiliation is a protected characteristic.",
    alternative: "This role may require work on [specific days]. Are you available on those days?",
    jurisdictions: ["US", "UK", "CA", "AU", "EU"],
  },
  // National origin / citizenship
  {
    pattern: /where are you from|what.?s your nationality|where were you born|country of origin|are you a (citizen|us citizen|american)/i,
    risk: "illegal",
    category: "National Origin",
    legal_basis: "Immigration Reform and Control Act (US); Equality Act (UK)",
    issue: "National origin is protected. Citizenship eligibility must be framed correctly.",
    alternative: "Are you authorized to work in [country] without visa sponsorship?",
    jurisdictions: ["US", "UK", "CA", "AU", "EU"],
  },
  // Race/ethnicity
  {
    pattern: /what (race|ethnicity) are you|are you (white|black|asian|hispanic|latino)/i,
    risk: "illegal",
    category: "Race/Ethnicity",
    legal_basis: "Title VII (US); Equality Act (UK)",
    issue: "Race and ethnicity are protected characteristics.",
    alternative: "No alternative — this question is never appropriate.",
    jurisdictions: ["US", "UK", "CA", "AU", "EU"],
  },
  // Disability
  {
    pattern: /do you have (a disability|any disabilities|a medical condition|health issues|chronic illness)|are you disabled/i,
    risk: "illegal",
    category: "Disability",
    legal_basis: "Americans with Disabilities Act (US); Equality Act (UK)",
    issue: "Disability status cannot be asked pre-offer. Post-offer, you may ask about reasonable accommodations.",
    alternative: "With or without reasonable accommodation, can you perform the essential functions of this role?",
    jurisdictions: ["US", "UK", "CA", "AU", "EU"],
  },
  // Arrest record (vs conviction)
  {
    pattern: /have you (ever been arrested|been arrested)/i,
    risk: "high",
    category: "Arrest Record",
    legal_basis: "EEOC guidance (US) — arrest records (not convictions) cannot be used as a disqualifier.",
    issue: "Arrests without conviction cannot be used in hiring decisions under EEOC guidance.",
    alternative: "Have you been convicted of a felony in the past 7 years? (Only if relevant to the role.)",
    jurisdictions: ["US"],
  },
  // Financial
  {
    pattern: /do you own (a home|your home)|what.?s your (mortgage|rent|credit score)/i,
    risk: "high",
    category: "Financial Status",
    legal_basis: "Some states prohibit credit history inquiries; correlates with protected classes.",
    issue: "Financial status questions can have discriminatory disparate impact.",
    alternative: "This role requires a credit check as part of a background screen. Do you consent?",
    jurisdictions: ["US"],
  },
  // Salary history (banned in many US states)
  {
    pattern: /what (is|was|were) your (current|previous|last|prior) salary|how much (do|did) you (make|earn)/i,
    risk: "high",
    category: "Salary History",
    legal_basis: "Salary history bans in 20+ US states (CA, NY, IL, MA, etc.); UK Pay Transparency guidance.",
    issue: "Salary history inquiries can perpetuate gender pay gaps and are banned in many jurisdictions.",
    alternative: "What are your salary expectations for this role?",
    jurisdictions: ["US", "UK"],
  },
];

export async function handleCheckIllegalQuestions(args: {
  questions: string[];
  jurisdiction: Jurisdiction;
  context?: string;
}): Promise<CallToolResult> {
  let totalRiskScore = 0;
  const flaggedCount = { none: 0, low: 0, medium: 0, high: 0, illegal: 0 };

  const auditResults = args.questions.map((question) => {
    const matchingRules = RULES.filter(
      (rule) =>
        rule.jurisdictions.includes(args.jurisdiction) &&
        rule.pattern.test(question)
    );

    if (matchingRules.length === 0) {
      flaggedCount.none++;
      return {
        question,
        is_problematic: false,
        risk_level: "none" as RiskLevel,
        legal_basis: null,
        issue_description: null,
        compliant_alternative: null,
      };
    }

    const worst = matchingRules.sort((a, b) => {
      const order: RiskLevel[] = ["none", "low", "medium", "high", "illegal"];
      return order.indexOf(b.risk) - order.indexOf(a.risk);
    })[0]!;

    const riskScore = { none: 0, low: 1, medium: 2, high: 3, illegal: 4 }[worst.risk];
    totalRiskScore += riskScore;
    flaggedCount[worst.risk]++;

    return {
      question,
      is_problematic: true,
      risk_level: worst.risk,
      legal_basis: worst.legal_basis,
      issue_description: `[${worst.category}] ${worst.issue}`,
      compliant_alternative: worst.alternative,
    };
  });

  const avgRisk = args.questions.length > 0 ? totalRiskScore / args.questions.length : 0;
  const overallRisk: RiskLevel =
    flaggedCount.illegal > 0 ? "illegal" :
    avgRisk >= 3 ? "high" :
    avgRisk >= 2 ? "medium" :
    avgRisk >= 1 ? "low" : "none";

  const jurisdictionNotes: Record<Jurisdiction, string> = {
    US: "US federal law (Title VII, ADEA, ADA, IRCA) applies. State laws may be more restrictive — consult legal counsel for CA, NY, IL, MA.",
    UK: "Equality Act 2010 applies. All protected characteristics must be considered.",
    EU: "GDPR and member-state employment laws apply. Questions must have a legal basis for data collection.",
    CA: "Canadian Human Rights Act and provincial codes apply. Protected grounds vary by province.",
    AU: "Fair Work Act and state anti-discrimination laws apply.",
  };

  const recommendation = flaggedCount.illegal > 0
    ? `STOP — ${flaggedCount.illegal} question(s) constitute illegal inquiries under ${args.jurisdiction} law. Remove them immediately before conducting interviews.`
    : flaggedCount.high > 0
    ? `Review required — ${flaggedCount.high} high-risk question(s) detected. Replace with compliant alternatives before use.`
    : flaggedCount.medium > 0
    ? `Caution — ${flaggedCount.medium} medium-risk question(s) detected. Review and revise.`
    : "Question set appears compliant. Continue with standard interview practices.";

  const result = {
    audit_results: auditResults,
    overall_risk: overallRisk,
    jurisdiction_notes: jurisdictionNotes[args.jurisdiction],
    flagged_count: flaggedCount.illegal + flaggedCount.high + flaggedCount.medium + flaggedCount.low,
    recommendation,
  };

  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}
