import { Agent, AgentContext, AgentResponse, AgentAction } from './types';
import { agentRegistry } from './registry';

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
        indicators: { type: 'array', items: { type: 'string' } }
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
    workflow: any[], 
    parallel: boolean = false
  ): Promise<AgentResponse> {
    const results: any[] = [];
    const errors: string[] = [];

    if (parallel) {
      // Execute all steps in parallel
      const promises = workflow.map(async (step) => {
        const agent = agentRegistry.getAgent(step.agent);
        if (!agent) {
          return { error: `Agent ${step.agent} not found` };
        }
        return await agent.execute(context, step.action, step.params);
      });

      const responses = await Promise.all(promises);
      responses.forEach((response, index) => {
        if (response.success) {
          results.push(response);
        } else {
          errors.push(`Step ${index + 1}: ${response.error}`);
        }
      });
    } else {
      // Execute steps sequentially
      for (let i = 0; i < workflow.length; i++) {
        const step = workflow[i];
        const agent = agentRegistry.getAgent(step.agent);
        
        if (!agent) {
          errors.push(`Step ${i + 1}: Agent ${step.agent} not found`);
          continue;
        }

        const response = await agent.execute(context, step.action, step.params);
        if (response.success) {
          results.push(response);
          // Update context with results for next steps
          if (response.data) {
            context = { ...context, ...response.data };
          }
        } else {
          errors.push(`Step ${i + 1}: ${response.error}`);
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
    indicators: string[]
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
      ...indicators.map(indicator => ({
        agent: 'chart-control',
        action: 'add-indicator',
        params: { indicator }
      })),
      // Perform analysis
      {
        agent: 'analysis',
        action: 'analyze-chart',
        params: { symbol, indicators }
      }
    ];

    return this.executeWorkflow(context, workflow, false);
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
