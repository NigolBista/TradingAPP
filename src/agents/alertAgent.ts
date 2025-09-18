import { Agent, AgentContext, AgentResponse, AlertResponse } from "./types";

export class AlertAgent implements Agent {
  name = "alert";
  description = "Manages alerts, notifications, and monitoring";

  capabilities = [
    {
      name: "create-price-alert",
      description: "Create price-based alert",
      parameters: {
        symbol: { type: "string" },
        condition: {
          type: "string",
          enum: ["above", "below", "crosses_above", "crosses_below"],
        },
        price: { type: "number" },
        message: { type: "string", optional: true },
      },
    },
    {
      name: "create-indicator-alert",
      description: "Create indicator-based alert",
      parameters: {
        symbol: { type: "string" },
        indicator: { type: "string" },
        condition: { type: "string" },
        value: { type: "number", optional: true },
        message: { type: "string", optional: true },
      },
    },
    {
      name: "create-pattern-alert",
      description: "Create pattern-based alert",
      parameters: {
        symbol: { type: "string" },
        pattern: { type: "string" },
        timeframe: { type: "string", optional: true },
        message: { type: "string", optional: true },
      },
    },
    {
      name: "create-news-alert",
      description: "Create news-based alert",
      parameters: {
        symbol: { type: "string" },
        keywords: { type: "array", items: { type: "string" }, optional: true },
        sentiment: {
          type: "string",
          enum: ["positive", "negative", "neutral"],
          optional: true,
        },
        message: { type: "string", optional: true },
      },
    },
    {
      name: "create-custom-alert",
      description: "Create custom alert with specific conditions",
      parameters: {
        symbol: { type: "string" },
        condition: { type: "string" },
        message: { type: "string" },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
          optional: true,
        },
      },
    },
    {
      name: "get-active-alerts",
      description: "Get all active alerts",
      parameters: {
        symbol: { type: "string", optional: true },
        type: { type: "string", optional: true },
      },
    },
    {
      name: "update-alert",
      description: "Update existing alert",
      parameters: {
        alertId: { type: "string" },
        updates: { type: "object" },
      },
    },
    {
      name: "delete-alert",
      description: "Delete alert",
      parameters: {
        alertId: { type: "string" },
      },
    },
    {
      name: "test-alert",
      description: "Test alert notification",
      parameters: {
        alertId: { type: "string" },
      },
    },
  ];

  private alerts: Map<string, any> = new Map();
  private alertCounter = 0;

  async execute(
    context: AgentContext,
    action: string,
    params?: any
  ): Promise<AgentResponse> {
    try {
      switch (action) {
        case "create-price-alert":
          return this.createPriceAlert(context, params);

        case "create-indicator-alert":
          return this.createIndicatorAlert(context, params);

        case "create-pattern-alert":
          return this.createPatternAlert(context, params);

        case "create-news-alert":
          return this.createNewsAlert(context, params);

        case "create-custom-alert":
          return this.createCustomAlert(context, params);

        case "get-active-alerts":
          return this.getActiveAlerts(context, params?.symbol, params?.type);

        case "update-alert":
          return this.updateAlert(context, params?.alertId, params?.updates);

        case "delete-alert":
          return this.deleteAlert(context, params?.alertId);

        case "test-alert":
          return this.testAlert(context, params?.alertId);

        default:
          return {
            success: false,
            error: `Unknown action: ${action}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `Alert agent error: ${error}`,
      };
    }
  }

  canHandle(action: string): boolean {
    return this.capabilities.some((cap) => cap.name === action);
  }

  getRequiredContext(): string[] {
    return ["symbol"];
  }

  private async createPriceAlert(
    context: AgentContext,
    params: any
  ): Promise<AlertResponse> {
    const { symbol, condition, price, message } = params;
    const alertId = `price_${++this.alertCounter}`;

    const alert = {
      id: alertId,
      type: "price",
      symbol,
      condition,
      price,
      message: message || `${symbol} price ${condition} ${price}`,
      priority: "medium",
      created: Date.now(),
      active: true,
    };

    this.alerts.set(alertId, alert);

    return {
      success: true,
      data: { alert },
      message: `Price alert created for ${symbol}`,
      alert: {
        type: "price" as const,
        condition: `${condition} ${price}`,
        value: price,
        message: message || `${symbol} price ${condition} ${price}`,
        priority: "medium" as const,
      },
    };
  }

  private async createIndicatorAlert(
    context: AgentContext,
    params: any
  ): Promise<AlertResponse> {
    const { symbol, indicator, condition, value, message } = params;
    const alertId = `indicator_${++this.alertCounter}`;

    const alert = {
      id: alertId,
      type: "indicator",
      symbol,
      indicator,
      condition,
      value,
      message:
        message ||
        `${symbol} ${indicator} ${condition} ${value || "threshold"}`,
      priority: "medium",
      created: Date.now(),
      active: true,
    };

    this.alerts.set(alertId, alert);

    return {
      success: true,
      data: { alert },
      message: `Indicator alert created for ${symbol}`,
      alert: {
        type: "indicator" as const,
        condition: `${indicator} ${condition}`,
        value,
        message: message || `${symbol} ${indicator} ${condition} ${value || "threshold"}`,
        priority: "medium" as const,
      },
    };
  }

  private async createPatternAlert(
    context: AgentContext,
    params: any
  ): Promise<AlertResponse> {
    const { symbol, pattern, timeframe, message } = params;
    const alertId = `pattern_${++this.alertCounter}`;

    const alert = {
      id: alertId,
      type: "pattern",
      symbol,
      pattern,
      timeframe: timeframe || "1D",
      message:
        message ||
        `${symbol} ${pattern} pattern detected on ${timeframe || "1D"}`,
      priority: "high",
      created: Date.now(),
      active: true,
    };

    this.alerts.set(alertId, alert);

    return {
      success: true,
      data: { alert },
      message: `Pattern alert created for ${symbol}`,
      alert: {
        type: "custom" as const,
        condition: `${pattern} pattern detected`,
        value: timeframe || "1D",
        message: message || `${symbol} ${pattern} pattern detected on ${timeframe || "1D"}`,
        priority: "high" as const,
      },
    };
  }

  private async createNewsAlert(
    context: AgentContext,
    params: any
  ): Promise<AlertResponse> {
    const { symbol, keywords, sentiment, message } = params;
    const alertId = `news_${++this.alertCounter}`;

    const alert = {
      id: alertId,
      type: "news",
      symbol,
      keywords: keywords || [],
      sentiment: sentiment || "neutral",
      message:
        message ||
        `News alert for ${symbol} with ${sentiment || "neutral"} sentiment`,
      priority: "medium",
      created: Date.now(),
      active: true,
    };

    this.alerts.set(alertId, alert);

    return {
      success: true,
      data: { alert },
      message: `News alert created for ${symbol}`,
      alert: {
        type: "news" as const,
        condition: `${sentiment || "neutral"} sentiment`,
        value: keywords,
        message: message || `News alert for ${symbol} with ${sentiment || "neutral"} sentiment`,
        priority: "medium" as const,
      },
    };
  }

  private async createCustomAlert(
    context: AgentContext,
    params: any
  ): Promise<AlertResponse> {
    const { symbol, condition, message, priority = "medium" } = params;
    const alertId = `custom_${++this.alertCounter}`;

    const alert = {
      id: alertId,
      type: "custom",
      symbol,
      condition,
      message: message || `Custom alert for ${symbol}: ${condition}`,
      priority,
      created: Date.now(),
      active: true,
    };

    this.alerts.set(alertId, alert);

    return {
      success: true,
      data: { alert },
      message: `Custom alert created for ${symbol}`,
      alert: {
        type: "custom" as const,
        condition: condition || "custom condition",
        message: message || `Custom alert for ${symbol}: ${condition}`,
        priority: (priority as "low" | "medium" | "high" | "critical") || "medium",
      },
    };
  }

  private async getActiveAlerts(
    context: AgentContext,
    symbol?: string,
    type?: string
  ): Promise<AgentResponse> {
    let filteredAlerts = Array.from(this.alerts.values()).filter(
      (alert) => alert.active
    );

    if (symbol) {
      filteredAlerts = filteredAlerts.filter(
        (alert) => alert.symbol === symbol
      );
    }

    if (type) {
      filteredAlerts = filteredAlerts.filter((alert) => alert.type === type);
    }

    return {
      success: true,
      data: { alerts: filteredAlerts, count: filteredAlerts.length },
      message: `Found ${filteredAlerts.length} active alerts`,
    };
  }

  private async updateAlert(
    context: AgentContext,
    alertId: string,
    updates: any
  ): Promise<AgentResponse> {
    const alert = this.alerts.get(alertId);

    if (!alert) {
      return {
        success: false,
        error: `Alert ${alertId} not found`,
      };
    }

    const updatedAlert = { ...alert, ...updates, updated: Date.now() };
    this.alerts.set(alertId, updatedAlert);

    return {
      success: true,
      data: { alert: updatedAlert },
      message: `Alert ${alertId} updated successfully`,
    };
  }

  private async deleteAlert(
    context: AgentContext,
    alertId: string
  ): Promise<AgentResponse> {
    const alert = this.alerts.get(alertId);

    if (!alert) {
      return {
        success: false,
        error: `Alert ${alertId} not found`,
      };
    }

    this.alerts.delete(alertId);

    return {
      success: true,
      data: { alertId },
      message: `Alert ${alertId} deleted successfully`,
    };
  }

  private async testAlert(
    context: AgentContext,
    alertId: string
  ): Promise<AlertResponse> {
    const alert = this.alerts.get(alertId);

    if (!alert) {
      return {
        success: false,
        error: `Alert ${alertId} not found`,
      };
    }

    // Simulate alert trigger
    const testAlert = {
      ...alert,
      triggered: true,
      triggerTime: Date.now(),
      testMode: true,
    };

    return {
      success: true,
      data: { alert: testAlert },
      message: `Test alert triggered for ${alert.symbol}`,
      alert: testAlert,
    };
  }
}
