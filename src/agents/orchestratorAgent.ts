import { Agent, AgentContext, AgentResponse, AgentAction, WorkflowStep } from './types';
import { agentRegistry } from './registry';
import { z } from 'zod';

const workflowStepSchema = z.object({
  agent: z.string(),
  action: z.string(),
  params: z.record(z.any()).optional(),
});

export class OrchestratorAgent implements Agent {
  name = 'orchestrator';
  description = 'Coordinates and orchestrates other agents to execute complex tasks';
  
  capabilities = [
    {
      name: 'execute-workflow',
      description: 'Execute a multi-step workflow using multiple agents',
      parameters: {
        workflow: { type: 'array', items: { type: 'object' } },
        parallel: { type: 'boolean', default: false }
      },
    },
    {
      name: 'coordinate-analysis',
      description: 'Coordinate comprehensive market analysis using multiple agents',
      parameters: {
        symbol: { type: 'string' },
        analysisType: { type: 'string', enum: ['technical', 'fundamental', 'sentiment', 'comprehensive'] }
      },
    },
    {
      name: 'execute-trading-plan',
      description: 'Execute a complete trading plan with analysis, chart setup, and execution',
      parameters: {
        symbol: { type: 'string' },
        strategy: { type: 'string' },
        riskLevel: { type: 'string', enum: ['conservative', 'moderate', 'aggressive'] }
      },
    },
    {
      name: 'setup-chart-analysis',
      description: 'Setup chart with indicators and perform analysis',
      parameters: {
        symbol: { type: 'string' },
        timeframe: { type: 'string' },
        indicators: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              indicator: { type: 'string' },
              options: { type: 'object', optional: true }
            }
          }
        }
      },
    },
    {
      name: 'determine-entry-exit',
      description: 'Setup chart and determine entry/exit points',
      parameters: {
        symbol: { type: 'string' },
        timeframe: { type: 'string', optional: true },
        indicators: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              indicator: { type: 'string' },
              options: { type: 'object', optional: true }
            }
          },
          optional: true,
        },
      },
    },
    {
      name: 'process-chart-command',
      description:
        'Interpret natural language chart commands and execute the appropriate actions',
      parameters: {
        command: { type: 'string' },
      },
    },
    {
      name: 'get-agent-status',
      description: 'Get status and capabilities of all registered agents',
      parameters: {},
    }
  ];

  async execute(context: AgentContext, action: string, params?: any): Promise<AgentResponse> {
    try {
      switch (action) {
        case 'execute-workflow':
          return this.executeWorkflow(context, params?.workflow, params?.parallel);
        
        case 'coordinate-analysis':
          return this.coordinateAnalysis(context, params?.symbol, params?.analysisType);
        
        case 'execute-trading-plan':
          return this.executeTradingPlan(context, params?.symbol, params?.strategy, params?.riskLevel);
        
        case 'setup-chart-analysis':
          return this.setupChartAnalysis(context, params?.symbol, params?.timeframe, params?.indicators);

        case 'determine-entry-exit':
          return this.determineEntryExit(context, params?.symbol, params?.timeframe, params?.indicators);

        case 'process-chart-command':
          return this.processChartCommand(context, params?.command);

        case 'get-agent-status':
          return this.getAgentStatus();
        
        default:
          return {
            success: false,
            error: `Unknown action: ${action}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `Orchestrator agent error: ${error}`,
      };
    }
  }

  canHandle(action: string): boolean {
    return this.capabilities.some(cap => cap.name === action);
  }

  getRequiredContext(): string[] {
    return ['symbol'];
  }

  private async executeWorkflow(
    context: AgentContext,
    workflow: WorkflowStep[],
    parallel: boolean = false
  ): Promise<AgentResponse> {
    const validation = z.array(workflowStepSchema).safeParse(workflow);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid workflow: ${validation.error.message}`,
      };
    }

    const steps = validation.data;
    const results: any[] = [];
    const errors: string[] = [];

    if (parallel) {
      const promises = steps.map(async (step, index) => {
        const agent = agentRegistry.getAgent(step.agent);
        if (!agent) {
          return { error: `Step ${index + 1}: Agent ${step.agent} not found` };
        }
        if (!agent.canHandle(step.action)) {
          return { error: `Step ${index + 1}: Agent ${step.agent} cannot handle ${step.action}` };
        }
        try {
          return await agent.execute(context, step.action, step.params);
        } catch (err: any) {
          return { error: err.message };
        }
      });

      const responses = await Promise.all(promises);
      responses.forEach((response) => {
        if (response.success) {
          results.push(response);
        } else if (response.error) {
          errors.push(response.error);
        }
      });
    } else {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const agent = agentRegistry.getAgent(step.agent);
        if (!agent) {
          errors.push(`Step ${i + 1}: Agent ${step.agent} not found`);
          continue;
        }
        if (!agent.canHandle(step.action)) {
          errors.push(`Step ${i + 1}: Agent ${step.agent} cannot handle ${step.action}`);
          continue;
        }
        try {
          const response = await agent.execute(context, step.action, step.params);
          if (response.success) {
            results.push(response);
            if (response.data) {
              context = { ...context, ...response.data };
            }
          } else {
            errors.push(`Step ${i + 1}: ${response.error}`);
          }
        } catch (err: any) {
          errors.push(`Step ${i + 1}: ${err.message}`);
        }
      }
    }

    return {
      success: errors.length === 0,
      data: { results, errors },
      message: `Workflow executed with ${results.length} successful steps and ${errors.length} errors`,
    };
  }

  private async coordinateAnalysis(
    context: AgentContext, 
    symbol: string, 
    analysisType: string
  ): Promise<AgentResponse> {
    const workflow = [];

    // Always get chart context first
    workflow.push({
      agent: 'chart-context',
      action: 'get-chart-context',
      params: {}
    });

    // Setup chart with basic indicators
    workflow.push({
      agent: 'chart-control',
      action: 'setup-chart',
      params: { symbol, timeframe: '1D' }
    });

    // Add analysis based on type
    switch (analysisType) {
      case 'technical':
        workflow.push({
          agent: 'analysis',
          action: 'technical-analysis',
          params: { symbol }
        });
        break;
      case 'fundamental':
        workflow.push({
          agent: 'analysis',
          action: 'fundamental-analysis',
          params: { symbol }
        });
        break;
      case 'sentiment':
        workflow.push({
          agent: 'news',
          action: 'analyze-sentiment',
          params: { symbol }
        });
        break;
      case 'comprehensive':
        workflow.push(
          {
            agent: 'analysis',
            action: 'technical-analysis',
            params: { symbol }
          },
          {
            agent: 'analysis',
            action: 'fundamental-analysis',
            params: { symbol }
          },
          {
            agent: 'news',
            action: 'analyze-sentiment',
            params: { symbol }
          }
        );
        break;
      default:
        return {
          success: false,
          error: `Unknown analysis type: ${analysisType}`,
        };
    }

    return this.executeWorkflow(context, workflow, analysisType === 'comprehensive');
  }

  private async executeTradingPlan(
    context: AgentContext, 
    symbol: string, 
    strategy: string, 
    riskLevel: string
  ): Promise<AgentResponse> {
    const workflow = [
      // Get chart context
      {
        agent: 'chart-context',
        action: 'get-chart-context',
        params: {}
      },
      // Setup chart
      {
        agent: 'chart-control',
        action: 'setup-chart',
        params: { symbol, timeframe: '1D' }
      },
      // Perform analysis
      {
        agent: 'analysis',
        action: 'comprehensive-analysis',
        params: { symbol }
      },
      // Generate strategy
      {
        agent: 'strategy',
        action: 'generate-strategy',
        params: { symbol, strategy, riskLevel }
      },
      // Execute trade if conditions are met
      {
        agent: 'trading',
        action: 'execute-trade',
        params: { symbol, strategy, riskLevel }
      }
    ];

    return this.executeWorkflow(context, workflow, false);
  }

  private async setupChartAnalysis(
    context: AgentContext,
    symbol: string,
    timeframe: string,
    indicators: { indicator: string; options?: any }[] = []
  ): Promise<AgentResponse> {
    const workflow = [
      // Get chart context
      {
        agent: 'chart-context',
        action: 'get-chart-context',
        params: {}
      },
      // Setup chart
      {
        agent: 'chart-control',
        action: 'setup-chart',
        params: { symbol, timeframe }
      },
      // Add indicators
      ...indicators.map(def => ({
        agent: 'chart-control',
        action: 'add-indicator',
        params: { indicator: def.indicator, options: def.options }
      })),
      // Perform analysis
      {
        agent: 'analysis',
        action: 'analyze-chart',
        params: { symbol, indicators: indicators.map(i => i.indicator) }
      }
    ];

    return this.executeWorkflow(context, workflow, false);
  }

  private async determineEntryExit(
    context: AgentContext,
    symbol: string,
    timeframe?: string,
    indicators: { indicator: string; options?: any }[] = []
  ): Promise<AgentResponse> {
    const workflow = [
      { agent: 'chart-context', action: 'get-chart-context', params: {} },
      {
        agent: 'chart-control',
        action: 'setup-chart',
        params: { symbol, timeframe: timeframe || '1D' }
      },
      ...indicators.map(def => ({
        agent: 'chart-control',
        action: 'add-indicator',
        params: { indicator: def.indicator, options: def.options }
      })),
      {
        agent: 'analysis',
        action: 'entry-exit-analysis',
        params: { symbol, indicators: indicators.map(i => i.indicator) }
      }
    ];

    return this.executeWorkflow(context, workflow, false);
  }

  private async processChartCommand(
    context: AgentContext,
    command: string
  ): Promise<AgentResponse> {
    const lower = command.toLowerCase();

    // Detect timeframe like 5m, 1h, 1d etc
    const timeframeMatch = lower.match(/(\d+)\s*(m|h|d|w)/);
    const timeframe = timeframeMatch
      ? `${timeframeMatch[1]}${timeframeMatch[2]}`
      : undefined;

    // Detect indicators from common list
    const knownIndicators = [
      'ema',
      'sma',
      'wma',
      'vwap',
      'rsi',
      'macd',
      'bollinger',
      'bb',
      'stochastic',
    ];
    const indicators = knownIndicators
      .filter((ind) => lower.includes(ind))
      .map((ind) => ({ indicator: ind.toUpperCase() }));

    const runAnalysis = /analysis|analyze/.test(lower);
    const runEntryExit = /entry|exit/.test(lower);

    const workflow: WorkflowStep[] = [
      { agent: 'chart-context', action: 'get-chart-context', params: {} },
    ];

    if (timeframe) {
      workflow.push({
        agent: 'chart-control',
        action: 'change-timeframe',
        params: { timeframe },
      });
    }

    indicators.forEach((def) =>
      workflow.push({
        agent: 'chart-control',
        action: 'add-indicator',
        params: { indicator: def.indicator },
      })
    );

    if (runAnalysis) {
      workflow.push({
        agent: 'analysis',
        action: 'analyze-chart',
        params: {
          symbol: context.symbol,
          indicators: indicators.map((i) => i.indicator),
        },
      });
    }

    if (runEntryExit) {
      workflow.push({
        agent: 'analysis',
        action: 'entry-exit-analysis',
        params: {
          symbol: context.symbol,
          indicators: indicators.map((i) => i.indicator),
        },
      });
    }

    const result = await this.executeWorkflow(context, workflow, false);

    // If entry/exit requested, attempt to show markers on chart
    if (runEntryExit && result.success) {
      const analysisResult = (result.data?.results || []).find(
        (r: any) => r.analysis && r.analysis.entry !== undefined
      );
      const entry = analysisResult?.analysis?.entry;
      const exit = analysisResult?.analysis?.exit;
      if (entry !== undefined && exit !== undefined) {
        const chartAgent = agentRegistry.getAgent('chart-control');
        await chartAgent?.execute(context, 'add-indicator', {
          indicator: 'entry',
          options: { price: entry },
        });
        await chartAgent?.execute(context, 'add-indicator', {
          indicator: 'exit',
          options: { price: exit },
        });
      }
    }

    const messages: string[] = [];
    if (timeframe) messages.push(`Timeframe set to ${timeframe}`);
    if (indicators.length)
      messages.push(
        `Added indicators: ${indicators
          .map((i) => i.indicator)
          .join(', ')}`
      );
    if (runEntryExit) {
      const analysisResult = (result.data?.results || []).find(
        (r: any) => r.analysis && r.analysis.entry !== undefined
      );
      if (analysisResult?.analysis) {
        messages.push(
          `Entry at ${analysisResult.analysis.entry.toFixed(2)}, exit at ${analysisResult.analysis.exit.toFixed(2)}`
        );
      } else {
        messages.push('Entry/exit analysis completed');
      }
    } else if (runAnalysis) {
      messages.push('Analysis completed');
    }

    return { ...result, message: messages.join('. ') || result.message };
  }

  private async getAgentStatus(): Promise<AgentResponse> {
    const agents = agentRegistry.getAllAgents();
    const status = agents.map(agent => ({
      name: agent.name,
      description: agent.description,
      capabilities: agent.capabilities.map(cap => cap.name),
      canHandle: agent.capabilities.map(cap => cap.name)
    }));

    return {
      success: true,
      data: { agents: status, total: agents.length },
      message: `Status of ${agents.length} registered agents`,
    };
  }
}
