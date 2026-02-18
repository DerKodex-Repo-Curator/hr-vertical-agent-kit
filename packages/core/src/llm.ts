import { getClient } from "./client.js";

const MODEL = "claude-sonnet-4-6";

/**
 * Call Claude and parse the response as JSON.
 * The system prompt is automatically appended with a strict JSON instruction.
 */
export async function callClaudeJSON<T>(
  system: string,
  user: string,
  maxTokens = 2048
): Promise<T> {
  const client = getClient();
  const fullSystem =
    system.trimEnd() +
    "\n\nCRITICAL: Your entire response must be a single valid JSON object. Do not include markdown code fences, explanations, or any text outside the JSON object.";

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: fullSystem,
    messages: [{ role: "user", content: user }],
  });

  const block = response.content.find((b) => b.type === "text");
  const raw = block?.type === "text" ? block.text.trim() : "{}";

  // Strip markdown fences if Claude added them despite instructions
  const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

  return JSON.parse(cleaned) as T;
}

/**
 * Call Claude and return the response as plain text.
 */
export async function callClaudeText(
  system: string,
  user: string,
  maxTokens = 2048
): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  const block = response.content.find((b) => b.type === "text");
  return block?.type === "text" ? block.text : "";
}
