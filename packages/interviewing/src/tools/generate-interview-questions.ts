import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
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

type QuestionBank = Record<string, Question[]>;

const QUESTION_BANK: QuestionBank = {
  leadership: [
    {
      id: "lead-1",
      question: "Tell me about a time you had to lead a team through a significant change or challenge.",
      competency: "leadership",
      question_type: "behavioral",
      follow_up_probes: [
        "What was the specific challenge?",
        "How did you get buy-in from resisters?",
        "What would you do differently?",
      ],
      what_good_looks_like: "Clear situation, specific actions taken, measurable outcome, reflection on lessons learned.",
      red_flags_to_watch: ["Takes sole credit", "No reflection on failures", "Unclear on their personal contribution"],
    },
    {
      id: "lead-2",
      question: "Describe a situation where you had to give difficult feedback to a direct report.",
      competency: "leadership",
      question_type: "behavioral",
      follow_up_probes: ["How did they respond?", "What was the outcome?", "How did the relationship evolve?"],
      what_good_looks_like: "Specific, timely feedback; empathy; actionable guidance; positive outcome or honest reflection.",
      red_flags_to_watch: ["Avoids conflict", "Blames the employee", "No follow-up"],
    },
  ],
  communication: [
    {
      id: "comm-1",
      question: "Give me an example of a complex idea you had to explain to a non-technical audience.",
      competency: "communication",
      question_type: "behavioral",
      follow_up_probes: ["How did you tailor your message?", "How did you know it landed?", "What feedback did you get?"],
      what_good_looks_like: "Audience awareness, clear analogy or framework, iterates based on feedback.",
      red_flags_to_watch: ["Cannot recall specific examples", "Jargon-heavy even now", "No attention to audience reaction"],
    },
    {
      id: "comm-2",
      question: "Tell me about a time miscommunication caused a problem. How did you resolve it?",
      competency: "communication",
      question_type: "behavioral",
      follow_up_probes: ["What was your role in the miscommunication?", "What systems did you put in place to prevent recurrence?"],
      what_good_looks_like: "Takes ownership, specific resolution steps, systemic fix implemented.",
      red_flags_to_watch: ["Blames only others", "No systemic change", "Minimizes impact"],
    },
  ],
  "problem-solving": [
    {
      id: "prob-1",
      question: "Walk me through how you approached the most complex problem you've solved in your career.",
      competency: "problem-solving",
      question_type: "behavioral",
      follow_up_probes: ["How did you define the problem?", "What options did you consider?", "How did you validate your solution?"],
      what_good_looks_like: "Structured approach (diagnose → hypothesize → test → iterate), data-driven, outcome articulated.",
      red_flags_to_watch: ["Jumps to solution without diagnosis", "Cannot explain reasoning", "No measurement of outcome"],
    },
    {
      id: "prob-2",
      question: "Tell me about a time you had to make a decision with incomplete information.",
      competency: "problem-solving",
      question_type: "situational",
      follow_up_probes: ["What information did you have?", "What risks did you identify?", "How did you validate afterward?"],
      what_good_looks_like: "Risk-aware, structured decision framework, comfort with ambiguity, retrospective.",
      red_flags_to_watch: ["Paralysis under ambiguity", "No risk assessment", "No retrospective"],
    },
  ],
  collaboration: [
    {
      id: "collab-1",
      question: "Describe a time you worked with a difficult stakeholder. How did you manage the relationship?",
      competency: "collaboration",
      question_type: "behavioral",
      follow_up_probes: ["What made them difficult?", "What was the outcome?", "What did you learn about working with different styles?"],
      what_good_looks_like: "Empathy, active listening, finds common ground, productive outcome.",
      red_flags_to_watch: ["Dehumanizes the stakeholder", "No attempt at understanding their perspective", "Escalated immediately"],
    },
  ],
  adaptability: [
    {
      id: "adapt-1",
      question: "Tell me about a time a project or plan changed significantly mid-way. How did you adapt?",
      competency: "adaptability",
      question_type: "behavioral",
      follow_up_probes: ["How did you reprioritize?", "How did you keep your team motivated?", "What was the result?"],
      what_good_looks_like: "Positive framing of change, clear reprioritization, team-centric response.",
      red_flags_to_watch: ["Resistant to change", "Blames external factors", "No team consideration"],
    },
  ],
};

const STAGE_CONFIG: Record<InterviewStage, { count: number; types: string[] }> = {
  phone_screen: { count: 4, types: ["behavioral", "cultural_fit"] },
  technical: { count: 6, types: ["technical", "situational"] },
  behavioral: { count: 8, types: ["behavioral", "situational"] },
  panel: { count: 8, types: ["behavioral", "situational", "cultural_fit"] },
  final: { count: 6, types: ["behavioral", "situational", "cultural_fit"] },
};

export async function handleGenerateInterviewQuestions(args: {
  job_description: string;
  candidate_resume?: string;
  interview_stage: InterviewStage;
  question_count: number;
  competencies: string[];
  include_follow_ups: boolean;
  avoid_topics?: string[];
}): Promise<CallToolResult> {
  const stageConfig = STAGE_CONFIG[args.interview_stage];
  const targetCount = Math.min(args.question_count, 20);
  const avoidSet = new Set((args.avoid_topics ?? []).map((t) => t.toLowerCase()));

  const questions: Question[] = [];

  // Pull from bank by competency, respecting stage types
  for (const competency of args.competencies) {
    const pool = (QUESTION_BANK[competency.toLowerCase()] ?? []).filter(
      (q) =>
        stageConfig.types.includes(q.question_type) &&
        !avoidSet.has(q.competency.toLowerCase())
    );
    questions.push(...pool);
    if (questions.length >= targetCount) break;
  }

  // Fill remaining with generic questions if needed
  if (questions.length < targetCount) {
    const generic: Question = {
      id: "generic-1",
      question: "Why are you interested in this role and our organization?",
      competency: "cultural_fit",
      question_type: "cultural_fit",
      follow_up_probes: ["What specifically excites you about this team?", "How does this role fit your longer-term goals?"],
      what_good_looks_like: "Specific knowledge of the company, authentic motivation, alignment with role responsibilities.",
      red_flags_to_watch: ["Generic answer", "Only mentions compensation", "No knowledge of the company"],
    };
    questions.push(generic);
  }

  const sliced = questions.slice(0, targetCount);

  const totalMinutes = sliced.length * 5 + (args.include_follow_ups ? sliced.length * 3 : 0) + 10;

  const stageLabel = args.interview_stage.replace("_", " ");
  const guideIntro = `This is a ${stageLabel} interview guide with ${sliced.length} questions targeting: ${args.competencies.join(", ")}. Estimated duration: ${totalMinutes} minutes. Allow the candidate to answer fully before probing.`;

  const result = {
    questions: sliced.map((q) => ({
      ...q,
      follow_up_probes: args.include_follow_ups ? q.follow_up_probes : [],
    })),
    interview_guide_intro: guideIntro,
    estimated_duration_minutes: totalMinutes,
  };

  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}
