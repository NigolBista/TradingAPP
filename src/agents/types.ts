// Base agent interface and types
export interface AgentContext {
  symbol: string;
  timeframe?: string;
  chartType?: string;
  indicators?: any[];
  currentPrice?: number;
  marketData?: any;
  userPreferences?: any;
  sessionId?: string;
}

export interface AgentResponse {
  success: boolean;
  data?: any;
  error?: string;
  actions?: AgentAction[];
  message?: string;
}

export interface AgentAction {
  type: string;
  payload: any;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  timestamp?: number;
}

export interface AgentCapability {
  name: string;
  description: string;
  parameters: Record<string, any>;
  requiredContext?: string[];
}

export interface Agent {
  name: string;
  description: string;
  capabilities: AgentCapability[];
  execute(context: AgentContext, action: string, params?: any): Promise<AgentResponse>;
  canHandle(action: string): boolean;
  getRequiredContext(): string[];
}

export interface AgentRegistry {
  register(agent: Agent): void;
  getAgent(name: string): Agent | undefined;
  getAgentsByCapability(capability: string): Agent[];
  getAllAgents(): Agent[];
}

// Specific agent response types
export interface ChartControlResponse extends AgentResponse {
  chartActions?: ChartAction[];
  screenshot?: string;
}

export interface AnalysisResponse extends AgentResponse {
  analysis?: {
    trend?: 'bullish' | 'bearish' | 'neutral';
    strength?: number;
    confidence?: number;
    signals?: any[];
    recommendations?: string[];
    entry?: number;
    exit?: number;
    stopLoss?: number;
    takeProfit?: number;
  };
}

export interface TradingResponse extends AgentResponse {
  trade?: {
    action: 'buy' | 'sell' | 'hold';
    quantity?: number;
    price?: number;
    stopLoss?: number;
    takeProfit?: number;
    reasoning?: string;
  };
}

export interface AlertResponse extends AgentResponse {
  alert?: {
    type: 'price' | 'indicator' | 'news' | 'custom';
    condition: string;
    value?: any;
    message: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
  };
}

// Chart action types (re-exported from chartBridge)
export type ChartAction =
  | { type: "setTimeframe"; timeframe: string }
  | { type: "addIndicator"; indicator: string; options?: Record<string, any> }
  | { type: "setLineColor"; color: string }
  | { type: "navigate"; direction: "left" | "right" }
  | { type: "checkNews" }
  | { type: "runAnalysis"; strategy?: string }
  | { type: "setChartType"; chartType: string }
  | { type: "toggleDisplayOption"; option: string; enabled: boolean };
