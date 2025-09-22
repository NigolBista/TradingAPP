import { Agent, AgentContext, AgentResponse } from "./types";
import { runChartSequence, SequenceStep } from "../logic/chartSequenceEngine";

export class ChartSequenceAgent implements Agent {
  name = "chart-sequence";
  description = "Executes narrated, cancelable chart-control sequences";

  capabilities = [
    {
      name: "run-sequence",
      description: "Run a chart control sequence",
      parameters: {
        steps: { type: "array", items: { type: "object" } },
        profile: {
          type: "string",
          enum: ["day_trade", "swing_trade"],
          optional: true,
        },
        narrate: { type: "boolean", default: true },
        layoutId: { type: "string", optional: true },
        timeframe: { type: "string", optional: true },
      },
    },
  ];

  canHandle(action: string): boolean {
    return action === "run-sequence";
  }

  getRequiredContext(): string[] {
    return [];
  }

  async execute(
    context: AgentContext,
    action: string,
    params?: any
  ): Promise<AgentResponse> {
    if (action !== "run-sequence")
      return { success: false, error: `Unknown action ${action}` };
    const { steps, profile, narrate } = params || {};
    const result = await runChartSequence((steps || []) as SequenceStep[], {
      profile,
      narrate,
    });
    return {
      success: result.ok,
      data: { screenshots: result.screenshots, cancelled: result.cancelled },
      message: result.cancelled ? "Sequence cancelled" : "Sequence completed",
    };
  }
}
