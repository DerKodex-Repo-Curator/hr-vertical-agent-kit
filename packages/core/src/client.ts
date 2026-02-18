import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Export it before starting the server: export ANTHROPIC_API_KEY=sk-ant-..."
      );
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}
