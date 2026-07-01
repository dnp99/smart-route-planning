import Anthropic from "@anthropic-ai/sdk";

// Route Advisor runs on Haiku 4.5 — it only translates the solver's structured
// output into language, so the cheapest/fastest capable model is the right fit.
export const ROUTE_ADVISOR_MODEL = "claude-haiku-4-5";

const readApiKey = (): string => process.env.ANTHROPIC_API_KEY?.trim() ?? "";

export const hasAnthropicKey = (): boolean => readApiKey().length > 0;

let client: Anthropic | null = null;

// Lazy singleton — never construct at module load so the app boots fine without
// a key (the advisor route returns 503 instead). Key stays server-side only.
export const getAnthropicClient = (): Anthropic => {
  if (!client) {
    const apiKey = readApiKey();
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured.");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
};
