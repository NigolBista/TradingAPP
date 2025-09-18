import { Agent, AgentContext, AgentResponse, TradingResponse } from "./types";

export class TradingAgent implements Agent {
  name = "trading";
  description = "Handles buy/sell decisions and trade execution";

  capabilities = [
    {
      name: "execute-trade",
      description: "Execute a buy or sell trade",
      parameters: {
        symbol: { type: "string" },
        action: { type: "string", enum: ["buy", "sell", "hold"] },
        quantity: { type: "number", optional: true },
        price: { type: "number", optional: true },
        stopLoss: { type: "number", optional: true },
        takeProfit: { type: "number", optional: true },
      },
    },
    {
      name: "generate-trade-signal",
      description: "Generate trading signal based on analysis",
      parameters: {
        symbol: { type: "string" },
        strategy: { type: "string", optional: true },
        riskLevel: {
          type: "string",
          enum: ["conservative", "moderate", "aggressive"],
          optional: true,
        },
      },
    },
    {
      name: "calculate-position-size",
      description: "Calculate optimal position size based on risk management",
      parameters: {
        symbol: { type: "string" },
        accountBalance: { type: "number" },
        riskPercentage: { type: "number", optional: true },
        stopLossDistance: { type: "number" },
      },
    },
    {
      name: "set-stop-loss",
      description: "Set stop loss for existing position",
      parameters: {
        symbol: { type: "string" },
        stopLoss: { type: "number" },
        positionType: { type: "string", enum: ["long", "short"] },
      },
    },
    {
      name: "set-take-profit",
      description: "Set take profit for existing position",
      parameters: {
        symbol: { type: "string" },
        takeProfit: { type: "number" },
        positionType: { type: "string", enum: ["long", "short"] },
      },
    },
    {
      name: "close-position",
      description: "Close existing position",
      parameters: {
        symbol: { type: "string" },
        reason: { type: "string", optional: true },
      },
    },
    {
      name: "get-portfolio-status",
      description: "Get current portfolio status and positions",
      parameters: {},
    },
    {
      name: "calculate-risk-reward",
      description: "Calculate risk-reward ratio for potential trade",
      parameters: {
        entryPrice: { type: "number" },
        stopLoss: { type: "number" },
        takeProfit: { type: "number" },
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
        case "execute-trade":
          return this.executeTrade(context, params);

        case "generate-trade-signal":
          return this.generateTradeSignal(
            context,
            params?.symbol,
            params?.strategy,
            params?.riskLevel
          );

        case "calculate-position-size":
          return this.calculatePositionSize(
            context,
            params?.symbol,
            params?.accountBalance,
            params?.riskPercentage,
            params?.stopLossDistance
          );

        case "set-stop-loss":
          return this.setStopLoss(
            context,
            params?.symbol,
            params?.stopLoss,
            params?.positionType
          );

        case "set-take-profit":
          return this.setTakeProfit(
            context,
            params?.symbol,
            params?.takeProfit,
            params?.positionType
          );

        case "close-position":
          return this.closePosition(context, params?.symbol, params?.reason);

        case "get-portfolio-status":
          return this.getPortfolioStatus(context);

        case "calculate-risk-reward":
          return this.calculateRiskReward(
            context,
            params?.entryPrice,
            params?.stopLoss,
            params?.takeProfit
          );

        default:
          return {
            success: false,
            error: `Unknown action: ${action}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `Trading agent error: ${error}`,
      };
    }
  }

  canHandle(action: string): boolean {
    return this.capabilities.some((cap) => cap.name === action);
  }

  getRequiredContext(): string[] {
    return ["symbol"];
  }

  private async executeTrade(
    context: AgentContext,
    params: any
  ): Promise<TradingResponse> {
    const { symbol, action, quantity, price, stopLoss, takeProfit } = params;

    // Mock trade execution - in real implementation, this would interface with broker API
    const trade = {
      action: action as "buy" | "sell" | "hold",
      quantity: quantity || this.calculateDefaultQuantity(symbol),
      price: price || context.currentPrice || 100,
      stopLoss:
        stopLoss ||
        this.calculateDefaultStopLoss(
          action,
          price || context.currentPrice || 100
        ),
      takeProfit:
        takeProfit ||
        this.calculateDefaultTakeProfit(
          action,
          price || context.currentPrice || 100
        ),
      reasoning: this.generateTradeReasoning(action, symbol),
      timestamp: Date.now(),
    };

    // Simulate trade execution
    const success = Math.random() > 0.1; // 90% success rate for demo

    return {
      success,
      data: { trade },
      message: success
        ? `Trade executed successfully for ${symbol}`
        : "Trade execution failed",
      trade: success ? trade : undefined,
    };
  }

  private async generateTradeSignal(
    context: AgentContext,
    symbol: string,
    strategy?: string,
    riskLevel?: string
  ): Promise<TradingResponse> {
    const signal = this.generateSignal(symbol, strategy, riskLevel);

    return {
      success: true,
      data: { signal },
      message: `Trading signal generated for ${symbol}`,
      trade: signal,
    };
  }

  private async calculatePositionSize(
    context: AgentContext,
    symbol: string,
    accountBalance: number,
    riskPercentage: number = 2,
    stopLossDistance: number
  ): Promise<AgentResponse> {
    const riskAmount = accountBalance * (riskPercentage / 100);
    const positionSize = riskAmount / stopLossDistance;

    return {
      success: true,
      data: {
        positionSize: Math.floor(positionSize),
        riskAmount,
        riskPercentage,
        stopLossDistance,
      },
      message: `Position size calculated for ${symbol}`,
    };
  }

  private async setStopLoss(
    context: AgentContext,
    symbol: string,
    stopLoss: number,
    positionType: string
  ): Promise<TradingResponse> {
    const trade = {
      action: "hold" as const,
      stopLoss,
      positionType,
      reasoning: `Stop loss set at ${stopLoss} for ${positionType} position`,
    };

    return {
      success: true,
      data: { trade },
      message: `Stop loss set for ${symbol}`,
      trade,
    };
  }

  private async setTakeProfit(
    context: AgentContext,
    symbol: string,
    takeProfit: number,
    positionType: string
  ): Promise<TradingResponse> {
    const trade = {
      action: "hold" as const,
      takeProfit,
      positionType,
      reasoning: `Take profit set at ${takeProfit} for ${positionType} position`,
    };

    return {
      success: true,
      data: { trade },
      message: `Take profit set for ${symbol}`,
      trade,
    };
  }

  private async closePosition(
    context: AgentContext,
    symbol: string,
    reason?: string
  ): Promise<TradingResponse> {
    const trade = {
      action: "sell" as const,
      reasoning: reason || "Position closed by user request",
      timestamp: Date.now(),
    };

    return {
      success: true,
      data: { trade },
      message: `Position closed for ${symbol}`,
      trade,
    };
  }

  private async getPortfolioStatus(
    context: AgentContext
  ): Promise<AgentResponse> {
    // Mock portfolio status
    const portfolio = {
      totalValue: 100000,
      positions: [
        { symbol: "AAPL", quantity: 100, currentPrice: 150, value: 15000 },
        { symbol: "GOOGL", quantity: 50, currentPrice: 2800, value: 140000 },
      ],
      cash: 85000,
      totalReturn: 0.05,
    };

    return {
      success: true,
      data: portfolio,
      message: "Portfolio status retrieved",
    };
  }

  private async calculateRiskReward(
    context: AgentContext,
    entryPrice: number,
    stopLoss: number,
    takeProfit: number
  ): Promise<AgentResponse> {
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);
    const riskRewardRatio = reward / risk;

    return {
      success: true,
      data: {
        riskRewardRatio: riskRewardRatio.toFixed(2),
        risk,
        reward,
        entryPrice,
        stopLoss,
        takeProfit,
      },
      message: `Risk-reward ratio calculated: ${riskRewardRatio.toFixed(2)}`,
    };
  }

  // Helper methods
  private calculateDefaultQuantity(symbol: string): number {
    // Mock calculation based on symbol
    return Math.floor(Math.random() * 100) + 10;
  }

  private calculateDefaultStopLoss(action: string, price: number): number {
    const percentage = action === "buy" ? 0.02 : 0.02; // 2% stop loss
    return action === "buy"
      ? price * (1 - percentage)
      : price * (1 + percentage);
  }

  private calculateDefaultTakeProfit(action: string, price: number): number {
    const percentage = action === "buy" ? 0.04 : 0.04; // 4% take profit
    return action === "buy"
      ? price * (1 + percentage)
      : price * (1 - percentage);
  }

  private generateTradeReasoning(action: string, symbol: string): string {
    const reasons = {
      buy: [
        `Strong bullish momentum detected for ${symbol}`,
        `Technical indicators suggest upward trend for ${symbol}`,
        `Support level holding strong for ${symbol}`,
        `Volume confirmation for ${symbol} breakout`,
      ],
      sell: [
        `Bearish divergence detected for ${symbol}`,
        `Resistance level rejection for ${symbol}`,
        `Stop loss triggered for ${symbol}`,
        `Take profit target reached for ${symbol}`,
      ],
      hold: [
        `Waiting for clearer signal for ${symbol}`,
        `Position management in progress for ${symbol}`,
        `Monitoring key levels for ${symbol}`,
      ],
    };

    const actionReasons =
      reasons[action as keyof typeof reasons] || reasons.hold;
    return actionReasons[Math.floor(Math.random() * actionReasons.length)];
  }

  private generateSignal(
    symbol: string,
    strategy?: string,
    riskLevel?: string
  ): any {
    const actions = ["buy", "sell", "hold"];
    const action = actions[Math.floor(Math.random() * actions.length)] as
      | "buy"
      | "sell"
      | "hold";

    return {
      action,
      symbol,
      strategy: strategy || "technical",
      riskLevel: riskLevel || "moderate",
      confidence: Math.random() * 100,
      reasoning: this.generateTradeReasoning(action, symbol),
      timestamp: Date.now(),
    };
  }
}
