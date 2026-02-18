# HR Vertical Agent Kit

Open-source, pre-built MCP agent templates for HR teams — covering the full hiring lifecycle from recruiting through onboarding. Drop these into any MCP-compatible client (Claude Desktop, custom agents) and start automating HR workflows today.

> **Why this exists**: Accenture charges enterprise prices for industry-specific HR AI. The open-source ecosystem has nothing comparable. This kit gives any team a production-ready starting point with real AI generation, not string templates.

---

## What's Inside

| Component | Count | Description |
|-----------|-------|-------------|
| MCP Servers | 3 | Recruiting, Interviewing, Onboarding |
| Tools | 12 | 4 tools per server (9 LLM-powered, 3 rule-based) |
| Prompt Templates | 9 | System prompts for common HR agent roles |
| Workflow Definitions | 3 | Orchestration YAML files |
| Eval Suites | 3 | 20+ executable test scenarios |

---

## MCP Servers

### `@hr-kit/recruiting`
Tools for the sourcing and screening phase:

| Tool | Type | Description |
|------|------|-------------|
| `parse_resume` | Rule-based | Extract structured contact, work history, education, and skills from raw resume text |
| `score_candidate` | **LLM** | Score a candidate 0-100 against a rubric — understands semantic equivalence (Python ≈ py) |
| `generate_job_description` | **LLM** | Generate a bias-aware, tone-matched JD in Markdown — actually writes, doesn't fill templates |
| `detect_bias` | Rule-based | Scan HR text for 30+ biased phrases across 6 categories with severity ratings and rewrites |

### `@hr-kit/interviewing`
Tools for the assessment phase:

| Tool | Type | Description |
|------|------|-------------|
| `generate_interview_questions` | **LLM** | Build a competency-based question guide tailored to the JD and candidate profile |
| `evaluate_response` | **LLM** | Score candidate responses with full semantic STAR analysis (1-5 scale) |
| `structure_feedback` | **LLM** | Transform raw interviewer notes into calibration-ready structured feedback |
| `check_illegal_questions` | Rule-based | Audit interview questions against US/UK/EU/CA/AU employment law |

### `@hr-kit/onboarding`
Tools for the onboarding phase:

| Tool | Type | Description |
|------|------|-------------|
| `create_onboarding_plan` | **LLM** | Generate a personalized 4-week role-specific onboarding plan (min 5 tasks/week) |
| `generate_welcome_email` | **LLM** | Draft a personalized welcome email with tone calibration (warm/professional/casual) |
| `answer_policy_question` | **LLM** | Answer HR policy questions with RAG on provided docs, confidence scoring, and escalation |
| `create_30_60_90_plan` | **LLM** | Build a milestone-based 30-60-90 day plan connected to real company goals |

---

## Quick Start

### Prerequisites
- Node.js ≥ 20
- npm ≥ 9
- An Anthropic API key (for LLM-powered tools)

### 1. Install and Build

```bash
git clone https://github.com/UmarbekFU/hr-vertical-agent-kit
cd hr-vertical-agent-kit
npm install
npm run build
```

### 2. Set Your API Key

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

The 3 rule-based tools (`parse_resume`, `detect_bias`, `check_illegal_questions`) work without an API key. The 9 LLM-powered tools return a clear error if the key is missing.

### 3. Test a Server

```bash
# List tools on the recruiting server
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | node packages/recruiting/dist/index.js

# Test a rule-based tool (no API key needed)
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}\n{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}\n{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"detect_bias","arguments":{"text":"We need a rockstar ninja developer. He will dominate the team.","bias_categories":["gender"],"severity_threshold":"all"}}}\n' \
  | node packages/recruiting/dist/index.js
```

---

## Claude Desktop Integration

Add to your `claude_desktop_config.json` (`~/Library/Application Support/Claude/` on macOS):

```json
{
  "mcpServers": {
    "hr-recruiting": {
      "command": "node",
      "args": ["/path/to/hr-vertical-agent-kit/packages/recruiting/dist/index.js"],
      "env": { "ANTHROPIC_API_KEY": "sk-ant-..." }
    },
    "hr-interviewing": {
      "command": "node",
      "args": ["/path/to/hr-vertical-agent-kit/packages/interviewing/dist/index.js"],
      "env": { "ANTHROPIC_API_KEY": "sk-ant-..." }
    },
    "hr-onboarding": {
      "command": "node",
      "args": ["/path/to/hr-vertical-agent-kit/packages/onboarding/dist/index.js"],
      "env": { "ANTHROPIC_API_KEY": "sk-ant-..." }
    }
  }
}
```

Then restart Claude Desktop and try:
> *"Use the parse_resume tool to extract info from this resume text: [paste resume]"*

---

## Running Evals

The eval runner spawns each MCP server as a subprocess, sends JSON-RPC tool calls, and runs structured assertions against the output.

```bash
# Run a single suite
npm run eval:recruiting
npm run eval:interviewing
npm run eval:onboarding

# Run all three suites
npm run eval
```

**Example output:**
```
recruiting-server-evals  Behavioral evaluation suite for the hr-recruiting MCP server
────────────────────────────────────────────────────────────────────────
  ✓ Parse a well-formed software engineer resume (4ms)
  ✓ Parse a sparse resume gracefully (1ms)
  ✓ Detect gendered language in job description (2ms)
  ✓ Report no bias in inclusive job description (1ms)
  ✓ Score a candidate who meets all must-have criteria (2341ms)
  ✓ Score a candidate who is missing critical qualifications (1876ms)
  ✓ Generated JD includes DEI statement when requested (3102ms)
  ✓ Generated JD omits DEI statement when opted out (2890ms)
────────────────────────────────────────────────────────────────────────
  8/8 passed
```

Rule-based tools run instantly. LLM tools take 1-4 seconds each and require `ANTHROPIC_API_KEY`.

---

## Project Structure

```
hr-vertical-agent-kit/
├── packages/
│   ├── core/               # Shared: Anthropic SDK client, callClaudeJSON, toolSuccess/toolError
│   ├── recruiting/         # MCP Server 1 — 4 tools
│   ├── interviewing/       # MCP Server 2 — 4 tools
│   └── onboarding/         # MCP Server 3 — 4 tools
├── scripts/
│   └── eval-runner.ts      # Executable eval runner (tsx, no build step)
├── prompts/                # 9 system prompt templates
│   ├── recruiting/
│   ├── interviewing/
│   └── onboarding/
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

## Legal & Compliance Notes

- **This is a tool, not legal counsel.** All bias detection and compliance checking is advisory. Consult qualified employment law advisors for your jurisdiction before use in production hiring.
- **Human review is required.** No tool output should be used as a final hiring decision without human review.
- **Jurisdiction matters.** Employment law varies significantly. The `check_illegal_questions` tool covers US, UK, EU, CA, and AU — specify your jurisdiction explicitly.
- **Data privacy**: Do not pass PII to these tools in production without appropriate data handling controls.

---

## Extending This Kit

### Add a new tool to an existing server
1. Create `packages/<server>/src/tools/<tool-name>.ts`
2. Implement `export async function handle<ToolName>(args): Promise<CallToolResult>` using `callClaudeJSON` from `@hr-kit/core`
3. Register in `packages/<server>/src/index.ts` with `server.tool(...)`
4. Add scenarios to `evals/<server>.eval.yaml`

### Add a new vertical
1. Create `packages/<vertical>/` with the same structure
2. Add to `workspaces` in root `package.json`
3. Follow the server/tools/prompts/workflows/evals pattern

---

## Stack

- **AI**: Claude via `@anthropic-ai/sdk` (model: `claude-sonnet-4-6`)
- **Runtime**: Node.js 20+, TypeScript 5.4
- **MCP SDK**: `@modelcontextprotocol/sdk` ^1.6.1
- **Validation**: Zod ^3.25
- **Eval runner**: `tsx` (no build step)
- **Module system**: NodeNext (ES2022)
- **Build**: `tsc` per package, npm workspaces root

---

*Built as Day 10 of the 100-day project challenge.*
