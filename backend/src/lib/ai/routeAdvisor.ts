import type { DeidentifiedRouteContext, RouteAdvisorResponse } from "../../../../shared/contracts";
import { parseRouteAdvisorResponse } from "../../../../shared/contracts";
import { HttpError } from "../http";
import { getAnthropicClient, ROUTE_ADVISOR_MODEL } from "./claude";

export const ROUTE_ADVISOR_SYSTEM = [
  "You are a scheduling assistant for a home-visit nurse. You are given the",
  "OUTPUT of a route optimizer that has already decided the stop order, arrival",
  "times, and warnings. Your only job is to translate that structured output into",
  "plain, encouraging English — you do NOT re-plan, reorder, or invent times.",
  "",
  "Rules:",
  "- Never propose a different stop order or new arrival times. The solver owns those.",
  '- Reference stops by their number only (e.g. "Stop 3"). You have no names or addresses.',
  "- Ground every statement in the data you are given. Never invent visits, delays, or facts.",
  '- A stop\'s window is "fixed" or "flexible" EXACTLY as given by its windowType, and a',
  '  warning\'s type is "fixed_late" vs "flexible_late" accordingly. Flexible windows are',
  '  "preferred" times. Never call a flexible/preferred window "fixed" or vice versa; if a',
  "  stop has no windowType, describe it as late without naming the window kind.",
  "- `brief`: 1–2 short sentences summarizing how the day looks (finish time, and whether",
  "  anything runs late or was left unscheduled).",
  "- `suggestions`: 0 to 3 concrete, actionable items ONLY when the data warrants them",
  "  (e.g. a late fixed window, an unscheduled visit, a long wait). If the day is clean,",
  "  return an empty list. Do not pad.",
  "- Keep it brief and calm. No emojis, no medical advice.",
].join("\n");

export const routeAdvisorUserMessage = (context: DeidentifiedRouteContext): string =>
  [
    "Here is the optimizer output for the planned route. Summarize it and advise.",
    "",
    "```json",
    JSON.stringify(context, null, 2),
    "```",
  ].join("\n");

// Structured output via a forced tool call — guarantees the { brief, suggestions }
// shape regardless of SDK output_config typing across versions.
const ADVICE_TOOL = {
  name: "emit_route_advice",
  description: "Return the route brief and up to three suggestions.",
  input_schema: {
    type: "object" as const,
    properties: {
      brief: {
        type: "string",
        description: "1–2 sentence plain-English summary of the planned day.",
      },
      suggestions: {
        type: "array",
        items: { type: "string" },
        description: "0–3 concrete, actionable suggestions grounded in the data.",
      },
    },
    required: ["brief", "suggestions"],
  },
};

const AI_UNAVAILABLE = "Route Advisor is temporarily unavailable.";

export const generateRouteAdvice = async (
  context: DeidentifiedRouteContext,
): Promise<RouteAdvisorResponse> => {
  const client = getAnthropicClient();

  let message;
  try {
    message = await client.messages.create({
      model: ROUTE_ADVISOR_MODEL,
      max_tokens: 400,
      system: ROUTE_ADVISOR_SYSTEM,
      tools: [ADVICE_TOOL],
      tool_choice: { type: "tool", name: ADVICE_TOOL.name },
      messages: [{ role: "user", content: routeAdvisorUserMessage(context) }],
    });
  } catch {
    throw new HttpError(502, AI_UNAVAILABLE);
  }

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new HttpError(502, AI_UNAVAILABLE);
  }

  const advice = parseRouteAdvisorResponse(toolUse.input);
  if (!advice) {
    throw new HttpError(502, AI_UNAVAILABLE);
  }

  // json_schema can't cap array length — enforce the 0–3 ceiling server-side.
  return {
    brief: advice.brief.trim(),
    suggestions: advice.suggestions
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 3),
  };
};
