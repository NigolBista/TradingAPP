import { Agent, AgentContext, AgentResponse } from "./types";

export class CritiqueAgent implements Agent {
  name = "critique";
  description = "Provides feedback on analyses, trade plans, and chart setups";

  capabilities = [
    {
      name: "review-analysis",
      description: "Review an analysis result and suggest improvements",
      parameters: {
        analysis: { type: "object" },
      },
    },
    {
      name: "review-trade-plan",
      description: "Critique a proposed trade plan for risk and feasibility",
      parameters: {
        plan: { type: "object" },
      },
    },
    {
      name: "evaluate-chart-setup",
      description: "Evaluate chart setup and provide enhancement tips",
      parameters: {
        setup: { type: "object" },
      },
    },
  ];

  async execute(
    context: AgentContext,
    action: string,
    params?: any
  ): Promise<AgentResponse> {
    try {
      switch (action) {
        case "review-analysis":
          return this.reviewAnalysis(params?.analysis);

        case "review-trade-plan":
          return this.reviewTradePlan(params?.plan);

        case "evaluate-chart-setup":
          return this.evaluateChartSetup(params?.setup);

        default:
          return {
            success: false,
            error: `Unknown action: ${action}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `Critique agent error: ${error}`,
      };
    }
  }

  canHandle(action: string): boolean {
    return this.capabilities.some((cap) => cap.name === action);
  }

  getRequiredContext(): string[] {
    return ["symbol"];
  }

  private async reviewAnalysis(analysis: any): Promise<AgentResponse> {
    return {
      success: true,
      data: {
        issues: [],
        suggestions: [],
        analysis,
      },
      message: "Analysis reviewed successfully",
    };
  }

  private async reviewTradePlan(plan: any): Promise<AgentResponse> {
    return {
      success: true,
      data: {
        risk: "moderate",
        notes: [],
        plan,
      },
      message: "Trade plan reviewed successfully",
    };
  }

  private async evaluateChartSetup(setup: any): Promise<AgentResponse> {
    return {
      success: true,
      data: {
        improvements: [],
        setup,
      },
      message: "Chart setup evaluated successfully",
    };
  }
}

