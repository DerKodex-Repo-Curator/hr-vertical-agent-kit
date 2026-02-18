/**
 * eval-runner.ts — Executable MCP eval suite runner
 *
 * Usage:
 *   npm run eval:recruiting
 *   npm run eval:interviewing
 *   npm run eval:onboarding
 *   npm run eval              (runs all three)
 */

import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { createInterface } from "readline";
import { load as loadYaml } from "js-yaml";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

// ── Types ─────────────────────────────────────────────────────────────────────

interface EvalSuite {
  suite: string;
  description?: string;
  scenarios: Scenario[];
}

interface Scenario {
  id: string;
  name: string;
  tool: string;
  input: Record<string, unknown>;
  assertions: Assertion[];
}

type Assertion =
  | { type: "json_field_present"; field: string }
  | { type: "json_field_min_length"; field: string; min: number }
  | { type: "json_field_range"; field: string; min: number; max: number }
  | { type: "field_not_empty"; field: string }
  | { type: "field_contains"; field: string; contains: string; case_insensitive?: boolean }
  | { type: "json_field_in"; field: string; values: unknown[] };

interface AssertionResult {
  pass: boolean;
  message: string;
}

// ── MCP Client (newline-delimited JSON-RPC over stdio) ────────────────────────

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

class McpClient {
  private proc: ChildProcessWithoutNullStreams;
  private pending: Map<number, PendingRequest> = new Map();
  private nextId = 1;

  constructor(serverPath: string) {
    this.proc = spawn("node", [serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    // The MCP SDK uses newline-delimited JSON (one JSON object per line)
    const rl = createInterface({ input: this.proc.stdout, crlfDelay: Infinity });

    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const msg = JSON.parse(trimmed) as {
          id?: number;
          result?: unknown;
          error?: { code?: number; message: string };
        };
        if (msg.id !== undefined) {
          const req = this.pending.get(msg.id);
          if (req) {
            this.pending.delete(msg.id);
            if (msg.error) req.reject(new Error(msg.error.message));
            else req.resolve(msg.result ?? null);
          }
        }
      } catch {
        // Ignore malformed lines
      }
    });

    // Suppress server stderr — it uses structured JSON logging to stderr
    this.proc.stderr.on("data", () => {});

    this.proc.on("error", (err) => {
      for (const req of this.pending.values()) req.reject(err);
      this.pending.clear();
    });
  }

  private write(message: object): void {
    this.proc.stdin.write(JSON.stringify(message) + "\n");
  }

  request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.write({ jsonrpc: "2.0", id, method, params });
    });
  }

  notify(method: string, params: unknown): void {
    this.write({ jsonrpc: "2.0", method, params });
  }

  async initialize(): Promise<void> {
    await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "eval-runner", version: "1.0" },
    });
    this.notify("notifications/initialized", {});
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    return this.request("tools/call", { name, arguments: args });
  }

  kill(): void {
    this.proc.kill("SIGTERM");
  }
}

// ── Field accessor ────────────────────────────────────────────────────────────
// Handles dot notation + bracket notation: "plan.days_1_30.goals", "questions[0].text"

function getField(obj: unknown, fieldPath: string): unknown {
  const parts = fieldPath.replace(/\[(\d+)\]/g, ".$1").split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// ── Assertion runner ──────────────────────────────────────────────────────────

function runAssertion(data: unknown, assertion: Assertion): AssertionResult {
  const field = getField(data, assertion.field);

  switch (assertion.type) {
    case "json_field_present":
      return {
        pass: field !== undefined && field !== null,
        message: `"${assertion.field}" is ${field !== undefined ? "present" : "missing"}`,
      };

    case "json_field_min_length": {
      const len = Array.isArray(field)
        ? field.length
        : typeof field === "string"
        ? field.length
        : 0;
      return {
        pass: len >= assertion.min,
        message: `"${assertion.field}" length = ${len} (need >= ${assertion.min})`,
      };
    }

    case "json_field_range": {
      const num = typeof field === "number" ? field : parseFloat(String(field));
      const pass = !isNaN(num) && num >= assertion.min && num <= assertion.max;
      return {
        pass,
        message: `"${assertion.field}" = ${isNaN(num) ? "NaN" : num} (expected ${assertion.min}-${assertion.max})`,
      };
    }

    case "field_not_empty": {
      const notEmpty = Array.isArray(field)
        ? field.length > 0
        : typeof field === "string"
        ? field.trim().length > 0
        : field !== null && field !== undefined;
      return {
        pass: notEmpty,
        message: `"${assertion.field}" is ${notEmpty ? "not empty" : "EMPTY"}`,
      };
    }

    case "field_contains": {
      const str =
        typeof field === "string" ? field : JSON.stringify(field ?? "");
      const haystack = assertion.case_insensitive ? str.toLowerCase() : str;
      const needle = assertion.case_insensitive
        ? assertion.contains.toLowerCase()
        : assertion.contains;
      const pass = haystack.includes(needle);
      return {
        pass,
        message: `"${assertion.field}" ${pass ? "contains" : "does NOT contain"} "${assertion.contains}"`,
      };
    }

    case "json_field_in": {
      const pass = assertion.values.includes(field);
      return {
        pass,
        message: `"${assertion.field}" = "${field}" (allowed: ${assertion.values.join(", ")})`,
      };
    }

    default:
      return { pass: false, message: `unknown assertion type` };
  }
}

// ── ANSI helpers ──────────────────────────────────────────────────────────────

const C = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  reset: "\x1b[0m",
};

// ── Suite runner ──────────────────────────────────────────────────────────────

const SERVER_PATHS: Record<string, string> = {
  recruiting: "packages/recruiting/dist/index.js",
  interviewing: "packages/interviewing/dist/index.js",
  onboarding: "packages/onboarding/dist/index.js",
};

const TOOL_TIMEOUT_MS = 90_000; // LLM tools can be slow

async function runSuite(
  suiteName: string
): Promise<{ passed: number; failed: number; total: number }> {
  const evalPath = path.join(ROOT, "evals", `${suiteName}.eval.yaml`);
  if (!fs.existsSync(evalPath)) {
    console.error(`${C.red}Eval file not found: ${evalPath}${C.reset}`);
    process.exit(1);
  }

  const suite = loadYaml(fs.readFileSync(evalPath, "utf-8")) as EvalSuite;
  const serverRelPath = SERVER_PATHS[suiteName]!;
  const serverPath = path.join(ROOT, serverRelPath);

  if (!fs.existsSync(serverPath)) {
    console.error(
      `${C.red}Server not built: ${serverRelPath}\nRun: npm run build${C.reset}`
    );
    process.exit(1);
  }

  console.log(
    `\n${C.bold}${C.cyan}${suite.suite}${C.reset}  ${C.dim}${suite.description ?? ""}${C.reset}`
  );
  console.log(`${C.dim}${"─".repeat(72)}${C.reset}`);

  const client = new McpClient(serverPath);

  // Give the server a moment to start before sending initialize
  await new Promise((r) => setTimeout(r, 400));
  await client.initialize();

  let passed = 0;
  let failed = 0;

  for (const scenario of suite.scenarios) {
    const start = Date.now();
    let data: unknown = {};
    let toolErrorMsg: string | null = null;

    try {
      const raw = (await Promise.race([
        client.callTool(scenario.tool, scenario.input),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`timed out after ${TOOL_TIMEOUT_MS / 1000}s`)),
            TOOL_TIMEOUT_MS
          )
        ),
      ])) as {
        content?: Array<{ type: string; text?: string }>;
        isError?: boolean;
      } | null;

      const text = raw?.content?.[0]?.text ?? "{}";

      try {
        data = JSON.parse(text);
      } catch {
        toolErrorMsg = `invalid JSON in response: ${text.slice(0, 120)}`;
        data = {};
      }

      if (raw?.isError && !toolErrorMsg) {
        toolErrorMsg =
          (data as { error?: string })?.error ?? "tool returned isError=true";
      }
    } catch (err) {
      toolErrorMsg = err instanceof Error ? err.message : String(err);
      data = {};
    }

    const elapsed = Date.now() - start;
    const results = scenario.assertions.map((a) =>
      runAssertion(data, a as Assertion)
    );
    const allPass = toolErrorMsg === null && results.every((r) => r.pass);

    if (allPass) {
      passed++;
      console.log(
        `  ${C.green}\u2713${C.reset} ${scenario.name} ${C.dim}(${elapsed}ms)${C.reset}`
      );
    } else {
      failed++;
      console.log(
        `  ${C.red}\u2717${C.reset} ${C.bold}${scenario.name}${C.reset} ${C.dim}(${elapsed}ms)${C.reset}`
      );
      if (toolErrorMsg) {
        console.log(`      ${C.red}Tool error: ${toolErrorMsg}${C.reset}`);
      }
      for (const r of results) {
        if (!r.pass) {
          console.log(`      ${C.red}\u2717${C.reset} ${C.dim}${r.message}${C.reset}`);
        }
      }
    }
  }

  client.kill();

  const total = passed + failed;
  const allGood = passed === total;
  console.log(`${C.dim}${"─".repeat(72)}${C.reset}`);
  console.log(
    `  ${allGood ? C.green : C.yellow}${passed}/${total} passed${C.reset}\n`
  );

  return { passed, failed, total };
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const arg = process.argv[2] ?? "all";
  const suitesToRun =
    arg === "all" ? Object.keys(SERVER_PATHS) : [arg];

  for (const name of suitesToRun) {
    if (!SERVER_PATHS[name]) {
      console.error(
        `${C.red}Unknown suite: "${name}". Available: ${Object.keys(SERVER_PATHS).join(", ")}, all${C.reset}`
      );
      process.exit(1);
    }
  }

  let totalPassed = 0;
  let totalFailed = 0;
  let totalScenarios = 0;

  for (const name of suitesToRun) {
    const { passed, failed, total } = await runSuite(name);
    totalPassed += passed;
    totalFailed += failed;
    totalScenarios += total;
  }

  if (suitesToRun.length > 1) {
    const allGood = totalFailed === 0;
    console.log(
      `${C.bold}TOTAL  ${allGood ? C.green : C.yellow}${totalPassed}/${totalScenarios} passed${C.reset}`
    );
  }

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((err: unknown) => {
  console.error(C.red, err, C.reset);
  process.exit(1);
});
