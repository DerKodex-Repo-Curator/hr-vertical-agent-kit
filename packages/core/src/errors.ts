import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function toolSuccess(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

export function toolError(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }, null, 2) }],
    isError: true,
  };
}

/**
 * Wraps an error (unknown) into a user-facing string.
 * Strips internal stack traces from the message.
 */
export function formatError(err: unknown, toolName: string): string {
  if (err instanceof Error) {
    const msg = err.message;
    // Surface API key errors cleanly
    if (msg.includes("ANTHROPIC_API_KEY")) return msg;
    // JSON parse errors on LLM output
    if (err instanceof SyntaxError) {
      return `${toolName}: LLM returned invalid JSON. Try again or simplify the input.`;
    }
    return `${toolName} failed: ${msg}`;
  }
  return `${toolName} failed: ${String(err)}`;
}
