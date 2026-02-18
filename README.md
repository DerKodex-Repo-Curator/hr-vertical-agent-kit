# HR Vertical Agent Kit

Open-source, pre-built MCP agent templates for HR teams — covering the full hiring lifecycle from recruiting through onboarding. Drop these into any MCP-compatible client (Claude Desktop, custom agents) and start automating HR workflows today.

> **Why this exists**: Accenture charges enterprise prices for industry-specific HR AI. The open-source ecosystem has nothing comparable. This kit gives any team a production-ready starting point.

---

## What's Inside

| Component | Count | Description |
|-----------|-------|-------------|
| MCP Servers | 3 | Recruiting, Interviewing, Onboarding |
| Tools | 12 | 4 tools per server |
| Prompt Templates | 9 | System prompts for common HR agent roles |
| Workflow Definitions | 3 | Orchestration YAML files |
| Eval Suites | 3 | 20+ test scenarios |

---

## MCP Servers

### `@hr-kit/recruiting`
Tools for the sourcing and screening phase:
- **`parse_resume`** — Extract structured contact, work history, education, and skills from raw resume text
- **`score_candidate`** — Score a candidate 0-100 against a rubric with weighted skills/experience/education dimensions
- **`generate_job_description`** — Generate a bias-aware, tone-matched JD in Markdown from a role spec
- **`detect_bias`** — Scan any HR text for 30+ biased phrases across 6 categories with severity ratings and suggested rewrites

### `@hr-kit/interviewing`
Tools for the assessment phase:
- **`generate_interview_questions`** — Build a competency-based question guide with STAR follow-ups and red-flag guidance
- **`evaluate_response`** — Score a candidate's response using STAR framework analysis (1-5 scale)
- **`structure_feedback`** — Transform raw interviewer notes into calibration-ready structured feedback
- **`check_illegal_questions`** — Audit interview questions against US/UK/EU/CA/AU employment law

### `@hr-kit/onboarding`
Tools for the onboarding phase:
- **`create_onboarding_plan`** — Generate a personalized 4-week day-by-day onboarding plan
- **`generate_welcome_email`** — Draft a personalized welcome email with logistics, culture, and FAQ sections
- **`answer_policy_question`** — Answer common HR policy questions with confidence scoring and escalation flags
- **`create_30_60_90_plan`** — Build a milestone-based 30-60-90 day success plan with check-in schedule

---

## Quick Start

### Prerequisites
- Node.js ≥ 20
- npm ≥ 9

### Install and Build

```bash
git clone <repo>
cd hr-vertical-agent-kit
npm install
npm run build
```

### Test a Server (Manual)

```bash
# List tools on the recruiting server
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | node packages/recruiting/dist/index.js

# List tools on the interviewing server
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | node packages/interviewing/dist/index.js

# List tools on the onboarding server
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | node packages/onboarding/dist/index.js
```

---

## Claude Desktop Integration

Add to your `claude_desktop_config.json` (`~/Library/Application Support/Claude/` on macOS):

```json
{
  "mcpServers": {
    "hr-recruiting": {
      "command": "node",
      "args": ["/path/to/hr-vertical-agent-kit/packages/recruiting/dist/index.js"]
    },
    "hr-interviewing": {
      "command": "node",
      "args": ["/path/to/hr-vertical-agent-kit/packages/interviewing/dist/index.js"]
    },
    "hr-onboarding": {
      "command": "node",
      "args": ["/path/to/hr-vertical-agent-kit/packages/onboarding/dist/index.js"]
    }
  }
}
```

Then restart Claude Desktop and try:
> *"Use the parse_resume tool to extract info from this resume text: [paste resume]"*

---

## Project Structure

```
hr-vertical-agent-kit/
├── packages/
│   ├── recruiting/         # MCP Server 1 — 4 tools
│   ├── interviewing/       # MCP Server 2 — 4 tools
│   └── onboarding/         # MCP Server 3 — 4 tools
├── prompts/                # 9 system prompt templates
│   ├── recruiting/         # resume-analyst, job-description-writer, bias-auditor
│   ├── interviewing/       # interview-question-generator, feedback-structurer, legal-compliance-checker
│   └── onboarding/         # onboarding-coordinator, policy-advisor, welcome-writer
├── workflows/              # 3 orchestration workflow definitions
│   ├── resume-screening-pipeline.yaml
│   ├── interview-pipeline.yaml
│   └── new-hire-onboarding.yaml
├── evals/                  # 3 evaluation suites (20+ scenarios)
│   ├── recruiting.eval.yaml
│   ├── interviewing.eval.yaml
│   └── onboarding.eval.yaml
├── package.json            # npm workspace root
└── tsconfig.base.json      # shared TypeScript config
```

---

## Example Workflows

### Screen 50 Resumes in 5 Minutes
```
You: Screen these 50 resumes against this job description. Bias-check the JD first,
     then parse and score all candidates. Give me a top-10 shortlist.

Agent: [uses detect_bias → parse_resume × 50 → score_candidate × 50 → ranks results]
```

### Build a Compliant Interview Guide
```
You: I'm interviewing a senior PM candidate tomorrow for a behavioral round.
     Generate 8 questions on leadership and problem-solving, then check them for legal compliance.

Agent: [uses generate_interview_questions → check_illegal_questions → delivers compliant guide]
```

### Onboard a New Hire in 2 Minutes
```
You: Sarah starts Monday as our new Head of Design. She's remote, senior-level.
     Generate her welcome email, 4-week onboarding plan, and 30-60-90 plan.

Agent: [uses generate_welcome_email + create_onboarding_plan + create_30_60_90_plan]
```

---

## Prompts Library

Each prompt template in `prompts/` is a ready-to-use system prompt with:
- YAML front-matter (metadata, variables, compliance notes)
- `{{ variable }}` placeholders for customization
- Built-in guardrails and compliance guidance

**Usage**: Copy the prompt body into your agent's system prompt, substituting variables for your company/role.

---

## Workflows

Workflow YAML files in `workflows/` define multi-step HR processes that chain the MCP servers together. Each workflow specifies:
- **Inputs**: What the orchestrating agent needs to provide
- **Steps**: Which server/tool to call, with foreach and depends_on support
- **Guards**: Conditions that block or warn before proceeding (e.g. high bias score)
- **Outputs**: What the workflow returns

These are definitions — implement an executor (Python, TypeScript, or your preferred agent framework) to run them.

---

## Evals

Test suites in `evals/` use a declarative YAML format compatible with the [agent-bench](../day8) framework. Each scenario defines:
- Tool inputs
- Expected output assertions (field presence, ranges, value membership, string contains)

Run evals with any agent-bench-compatible runner.

---

## Legal & Compliance Notes

- **This is a tool, not legal counsel.** All bias detection and compliance checking is advisory. Consult qualified employment law advisors for your jurisdiction before use in production hiring.
- **Human review is required.** No tool output should be used as a final hiring decision without human review.
- **Jurisdiction matters.** Employment law varies significantly. The `check_illegal_questions` tool covers US, UK, EU, CA, and AU — specify your jurisdiction explicitly.
- **Data privacy**: Do not pass PII to these tools in production without appropriate data handling controls.

---

## Extending This Kit

### Add a new tool to an existing server
1. Create `packages/<server>/src/tools/<tool-name>.ts`
2. Implement `export async function handle<ToolName>(args): Promise<CallToolResult>`
3. Register in `packages/<server>/src/index.ts` with `server.tool(...)`
4. Add scenarios to `evals/<server>.eval.yaml`

### Add a new vertical
1. Create `packages/<vertical>/` with the same structure
2. Add to `workspaces` in root `package.json`
3. Follow the server/tools/prompts/workflows/evals pattern

---

## Stack

- **Runtime**: Node.js 20+, TypeScript 5.4
- **MCP SDK**: `@modelcontextprotocol/sdk` ^1.6.1
- **Validation**: Zod ^3.25
- **Module system**: NodeNext (ES2022)
- **Build**: `tsc` per package, npm workspaces root

---

*Built as Day 10 of the 100-day project challenge.*
