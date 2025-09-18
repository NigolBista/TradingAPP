import { Agent, AgentContext, AgentResponse } from "./types";
import { STRATEGY_COMPLEXITY_CONFIGS } from "../logic/strategyComplexity";

export class StrategyAgent implements Agent {
  name = "strategy";
  description = "Generates and manages trading strategies";

  capabilities = [
    {
      name: "generate-strategy",
      description: "Generate trading strategy based on market conditions",
      parameters: {
        symbol: { type: "string" },
        strategyType: {
          type: "string",
          enum: [
            "day_trade",
            "swing_trade",
            "trend_follow",
            "mean_reversion",
            "breakout",
          ],
        },
        complexity: {
          type: "string",
          enum: ["simple", "partial", "advanced"],
          optional: true,
        },
        riskLevel: {
          type: "string",
          enum: ["conservative", "moderate", "aggressive"],
          optional: true,
        },
      },
    },
    {
      name: "optimize-strategy",
      description: "Optimize existing strategy based on performance",
      parameters: {
        strategyId: { type: "string" },
        performanceData: { type: "object" },
        optimizationGoals: {
          type: "array",
          items: { type: "string" },
          optional: true,
        },
      },
    },
    {
      name: "backtest-strategy",
      description: "Backtest strategy on historical data",
      parameters: {
        symbol: { type: "string" },
        strategy: { type: "object" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        timeframe: { type: "string", optional: true },
      },
    },
    {
      name: "get-strategy-templates",
      description: "Get available strategy templates",
      parameters: {
        category: { type: "string", optional: true },
      },
    },
    {
      name: "validate-strategy",
      description: "Validate strategy parameters and logic",
      parameters: {
        strategy: { type: "object" },
      },
    },
    {
      name: "get-complexity-config",
      description: "Get strategy complexity configuration",
      parameters: {
        complexity: { type: "string", enum: ["simple", "partial", "advanced"] },
      },
    },
    {
      name: "calculate-risk-parameters",
      description: "Calculate risk parameters for strategy",
      parameters: {
        strategy: { type: "object" },
        accountBalance: { type: "number" },
        riskTolerance: {
          type: "string",
          enum: ["conservative", "moderate", "aggressive"],
        },
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
        case "generate-strategy":
          return this.generateStrategy(context, params);

        case "optimize-strategy":
          return this.optimizeStrategy(
            context,
            params?.strategyId,
            params?.performanceData,
            params?.optimizationGoals
          );

        case "backtest-strategy":
          return this.backtestStrategy(
            context,
            params?.symbol,
            params?.strategy,
            params?.startDate,
            params?.endDate,
            params?.timeframe
          );

        case "get-strategy-templates":
          return this.getStrategyTemplates(context, params?.category);

        case "validate-strategy":
          return this.validateStrategy(context, params?.strategy);

        case "get-complexity-config":
          return this.getComplexityConfig(context, params?.complexity);

        case "calculate-risk-parameters":
          return this.calculateRiskParameters(
            context,
            params?.strategy,
            params?.accountBalance,
            params?.riskTolerance
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
        error: `Strategy agent error: ${error}`,
      };
    }
  }

  canHandle(action: string): boolean {
    return this.capabilities.some((cap) => cap.name === action);
  }

  getRequiredContext(): string[] {
    return ["symbol"];
  }

  private async generateStrategy(
    context: AgentContext,
    params: any
  ): Promise<AgentResponse> {
    const {
      symbol,
      strategyType,
      complexity = "advanced",
      riskLevel = "moderate",
    } = params;

    const strategy = this.createStrategy(
      symbol,
      strategyType,
      complexity,
      riskLevel
    );

    return {
      success: true,
      data: { strategy },
      message: `Strategy generated for ${symbol}`,
    };
  }

  private async optimizeStrategy(
    context: AgentContext,
    strategyId: string,
    performanceData: any,
    optimizationGoals?: string[]
  ): Promise<AgentResponse> {
    // Mock optimization logic
    const optimizedStrategy = {
      id: strategyId,
      ...performanceData,
      optimized: true,
      improvements: [
        "Reduced drawdown by 15%",
        "Increased win rate by 8%",
        "Improved risk-reward ratio",
      ],
      timestamp: Date.now(),
    };

    return {
      success: true,
      data: { strategy: optimizedStrategy },
      message: `Strategy ${strategyId} optimized successfully`,
    };
  }

  private async backtestStrategy(
    context: AgentContext,
    symbol: string,
    strategy: any,
    startDate: string,
    endDate: string,
    timeframe?: string
  ): Promise<AgentResponse> {
    // Mock backtest results
    const backtestResults = {
      symbol,
      strategy,
      period: { startDate, endDate },
      timeframe: timeframe || "1D",
      results: {
        totalTrades: Math.floor(Math.random() * 100) + 20,
        winRate: Math.random() * 40 + 50, // 50-90%
        profitFactor: Math.random() * 2 + 1, // 1-3
        maxDrawdown: Math.random() * 20 + 5, // 5-25%
        sharpeRatio: Math.random() * 2 + 0.5, // 0.5-2.5
        totalReturn: Math.random() * 100 + 10, // 10-110%
        averageTrade: Math.random() * 1000 + 100, // 100-1100
      },
      trades: this.generateMockTrades(20),
      timestamp: Date.now(),
    };

    return {
      success: true,
      data: backtestResults,
      message: `Backtest completed for ${symbol}`,
    };
  }

  private async getStrategyTemplates(
    context: AgentContext,
    category?: string
  ): Promise<AgentResponse> {
    const templates = this.getStrategyTemplatesByCategory(category);

    return {
      success: true,
      data: { templates, count: templates.length },
      message: `Retrieved ${templates.length} strategy templates`,
    };
  }

  private async validateStrategy(
    context: AgentContext,
    strategy: any
  ): Promise<AgentResponse> {
    const validation = this.validateStrategyLogic(strategy);

    return {
      success: validation.isValid,
      data: validation,
      message: validation.isValid
        ? "Strategy is valid"
        : "Strategy validation failed",
    };
  }

  private async getComplexityConfig(
    context: AgentContext,
    complexity: string
  ): Promise<AgentResponse> {
    const config =
      STRATEGY_COMPLEXITY_CONFIGS[
        complexity as keyof typeof STRATEGY_COMPLEXITY_CONFIGS
      ];

    if (!config) {
      return {
        success: false,
        error: `Unknown complexity level: ${complexity}`,
      };
    }

    return {
      success: true,
      data: config,
      message: `Complexity configuration for ${complexity}`,
    };
  }

  private async calculateRiskParameters(
    context: AgentContext,
    strategy: any,
    accountBalance: number,
    riskTolerance: string
  ): Promise<AgentResponse> {
    const riskParams = this.calculateRisk(
      strategy,
      accountBalance,
      riskTolerance
    );

    return {
      success: true,
      data: riskParams,
      message: "Risk parameters calculated",
    };
  }

  // Helper methods
  private createStrategy(
    symbol: string,
    strategyType: string,
    complexity: string,
    riskLevel: string
  ): any {
    const baseStrategy = {
      id: `strategy_${Date.now()}`,
      symbol,
      type: strategyType,
      complexity,
      riskLevel,
      created: Date.now(),
      status: "active",
    };

    switch (strategyType) {
      case "day_trade":
        return {
          ...baseStrategy,
          timeframe: "1m",
          maxHoldTime: "4 hours",
          entryRules: ["Breakout above resistance", "Volume confirmation"],
          exitRules: ["Stop loss at 2%", "Take profit at 4%"],
          riskManagement: "2% account risk per trade",
        };

      case "swing_trade":
        return {
          ...baseStrategy,
          timeframe: "1D",
          maxHoldTime: "2 weeks",
          entryRules: ["Pullback to support", "RSI oversold"],
          exitRules: ["Stop loss at 5%", "Take profit at 10%"],
          riskManagement: "3% account risk per trade",
        };

      case "trend_follow":
        return {
          ...baseStrategy,
          timeframe: "1D",
          maxHoldTime: "1 month",
          entryRules: ["Price above 50-day MA", "MACD bullish crossover"],
          exitRules: ["Price below 50-day MA", "MACD bearish crossover"],
          riskManagement: "4% account risk per trade",
        };

      case "mean_reversion":
        return {
          ...baseStrategy,
          timeframe: "1D",
          maxHoldTime: "1 week",
          entryRules: ["RSI below 30", "Price at support"],
          exitRules: ["RSI above 70", "Price at resistance"],
          riskManagement: "2% account risk per trade",
        };

      case "breakout":
        return {
          ...baseStrategy,
          timeframe: "1D",
          maxHoldTime: "1 week",
          entryRules: ["Volume breakout", "Price above resistance"],
          exitRules: ["Volume decline", "Price below breakout level"],
          riskManagement: "3% account risk per trade",
        };

      default:
        return baseStrategy;
    }
  }

  private getStrategyTemplatesByCategory(category?: string): any[] {
    const templates = [
      {
        id: "template_1",
        name: "Scalping Strategy",
        category: "day_trading",
        description: "High-frequency scalping for volatile markets",
        complexity: "advanced",
        riskLevel: "aggressive",
      },
      {
        id: "template_2",
        name: "Momentum Strategy",
        category: "swing_trading",
        description: "Follow strong momentum moves",
        complexity: "partial",
        riskLevel: "moderate",
      },
      {
        id: "template_3",
        name: "Value Strategy",
        category: "long_term",
        description: "Buy undervalued stocks",
        complexity: "simple",
        riskLevel: "conservative",
      },
    ];

    return category
      ? templates.filter((t) => t.category === category)
      : templates;
  }

  private validateStrategyLogic(strategy: any): any {
    const errors: string[] = [];

    if (!strategy.type) errors.push("Strategy type is required");
    if (!strategy.entryRules || strategy.entryRules.length === 0)
      errors.push("Entry rules are required");
    if (!strategy.exitRules || strategy.exitRules.length === 0)
      errors.push("Exit rules are required");
    if (!strategy.riskManagement) errors.push("Risk management is required");

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  private calculateRisk(
    strategy: any,
    accountBalance: number,
    riskTolerance: string
  ): any {
    const riskMultipliers = {
      conservative: 0.01,
      moderate: 0.02,
      aggressive: 0.04,
    };

    const riskPercentage =
      riskMultipliers[riskTolerance as keyof typeof riskMultipliers] || 0.02;
    const maxRiskAmount = accountBalance * riskPercentage;

    return {
      accountBalance,
      riskTolerance,
      maxRiskAmount,
      riskPercentage: riskPercentage * 100,
      positionSize: Math.floor(maxRiskAmount / 100), // Assuming $100 per share
      stopLossDistance: 2, // 2% stop loss
      takeProfitDistance: 4, // 4% take profit
    };
  }

  private generateMockTrades(count: number): any[] {
    const trades = [];
    for (let i = 0; i < count; i++) {
      trades.push({
        id: `trade_${i + 1}`,
        entry: Math.random() * 100 + 50,
        exit: Math.random() * 100 + 50,
        profit: Math.random() * 200 - 100,
        date: new Date(
          Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
      });
    }
    return trades;
  }
}
