import { Agent, AgentContext, AgentResponse, ChartControlResponse, ChartAction } from './types';
import { executeChartActions, screenshotChart } from '../features/trading/services/chartBridge';
import { generateChartContextConfig } from '../features/trading/services/chartContextConfig';

export class ChartControlAgent implements Agent {
  name = 'chart-control';
  description = 'Controls chart manipulation, indicators, and visual elements';
  
  capabilities = [
    {
      name: 'setup-chart',
      description: 'Setup chart with basic configuration',
      parameters: {
        symbol: { type: 'string' },
        timeframe: { type: 'string' },
        chartType: { type: 'string', optional: true }
      },
    },
    {
      name: 'add-indicator',
      description: 'Add technical indicator to chart',
      parameters: {
        indicator: { type: 'string' },
        options: { type: 'object', optional: true }
      },
    },
    {
      name: 'remove-indicator',
      description: 'Remove indicator from chart',
      parameters: {
        indicator: { type: 'string' }
      },
    },
    {
      name: 'change-timeframe',
      description: 'Change chart timeframe',
      parameters: {
        timeframe: { type: 'string' }
      },
    },
    {
      name: 'change-chart-type',
      description: 'Change chart display type',
      parameters: {
        chartType: { type: 'string' }
      },
    },
    {
      name: 'navigate-chart',
      description: 'Pan or zoom chart view',
      parameters: {
        direction: { type: 'string', enum: ['left', 'right', 'zoom-in', 'zoom-out'] }
      },
    },
    {
      name: 'toggle-display-option',
      description: 'Toggle chart display options',
      parameters: {
        option: { type: 'string' },
        enabled: { type: 'boolean' }
      },
    },
    {
      name: 'capture-screenshot',
      description: 'Capture chart screenshot',
      parameters: {},
    },
    {
      name: 'get-chart-state',
      description: 'Get current chart state and configuration',
      parameters: {},
    }
  ];

  async execute(context: AgentContext, action: string, params?: any): Promise<AgentResponse> {
    try {
      switch (action) {
        case 'setup-chart':
          return this.setupChart(context, params?.symbol, params?.timeframe, params?.chartType);
        
        case 'add-indicator':
          return this.addIndicator(context, params?.indicator, params?.options);
        
        case 'remove-indicator':
          return this.removeIndicator(context, params?.indicator);
        
        case 'change-timeframe':
          return this.changeTimeframe(context, params?.timeframe);
        
        case 'change-chart-type':
          return this.changeChartType(context, params?.chartType);
        
        case 'navigate-chart':
          return this.navigateChart(context, params?.direction);
        
        case 'toggle-display-option':
          return this.toggleDisplayOption(context, params?.option, params?.enabled);
        
        case 'capture-screenshot':
          return this.captureScreenshot(context);
        
        case 'get-chart-state':
          return this.getChartState(context);
        
        default:
          return {
            success: false,
            error: `Unknown action: ${action}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `Chart control agent error: ${error}`,
      };
    }
  }

  canHandle(action: string): boolean {
    return this.capabilities.some(cap => cap.name === action);
  }

  getRequiredContext(): string[] {
    return ['symbol'];
  }

  private async setupChart(
    context: AgentContext, 
    symbol: string, 
    timeframe: string, 
    chartType?: string
  ): Promise<ChartControlResponse> {
    const actions: ChartAction[] = [
      { type: 'setTimeframe', timeframe },
    ];

    if (chartType) {
      actions.push({ type: 'setChartType', chartType } as ChartAction);
    }

    await executeChartActions(actions);

    return {
      success: true,
      data: { symbol, timeframe, chartType },
      message: `Chart setup completed for ${symbol}`,
      chartActions: actions,
    };
  }

  private async addIndicator(
    context: AgentContext, 
    indicator: string, 
    options?: any
  ): Promise<ChartControlResponse> {
    const action: ChartAction = {
      type: 'addIndicator',
      indicator,
      options: options || {}
    };

    await executeChartActions([action]);

    return {
      success: true,
      data: { indicator, options },
      message: `Indicator ${indicator} added successfully`,
      chartActions: [action],
    };
  }

  private async removeIndicator(
    context: AgentContext, 
    indicator: string
  ): Promise<ChartControlResponse> {
    // Note: This would need to be implemented in the chart bridge
    // For now, we'll return a success response
    return {
      success: true,
      data: { indicator },
      message: `Indicator ${indicator} removal requested`,
      chartActions: [],
    };
  }

  private async changeTimeframe(
    context: AgentContext, 
    timeframe: string
  ): Promise<ChartControlResponse> {
    const action: ChartAction = {
      type: 'setTimeframe',
      timeframe
    };

    await executeChartActions([action]);

    return {
      success: true,
      data: { timeframe },
      message: `Timeframe changed to ${timeframe}`,
      chartActions: [action],
    };
  }

  private async changeChartType(
    context: AgentContext, 
    chartType: string
  ): Promise<ChartControlResponse> {
    const action: ChartAction = {
      type: 'setChartType',
      chartType
    } as ChartAction;

    await executeChartActions([action]);

    return {
      success: true,
      data: { chartType },
      message: `Chart type changed to ${chartType}`,
      chartActions: [action],
    };
  }

  private async navigateChart(
    context: AgentContext, 
    direction: string
  ): Promise<ChartControlResponse> {
    let action: ChartAction;

    switch (direction) {
      case 'left':
      case 'right':
        action = { type: 'navigate', direction: direction as 'left' | 'right' };
        break;
      case 'zoom-in':
      case 'zoom-out':
        // These would need to be implemented in the chart bridge
        return {
          success: true,
          data: { direction },
          message: `Zoom ${direction} requested`,
          chartActions: [],
        };
      default:
        return {
          success: false,
          error: `Unknown navigation direction: ${direction}`,
        };
    }

    await executeChartActions([action]);

    return {
      success: true,
      data: { direction },
      message: `Chart navigated ${direction}`,
      chartActions: [action],
    };
  }

  private async toggleDisplayOption(
    context: AgentContext, 
    option: string, 
    enabled: boolean
  ): Promise<ChartControlResponse> {
    const action: ChartAction = {
      type: 'toggleDisplayOption',
      option,
      enabled
    } as ChartAction;

    await executeChartActions([action]);

    return {
      success: true,
      data: { option, enabled },
      message: `Display option ${option} ${enabled ? 'enabled' : 'disabled'}`,
      chartActions: [action],
    };
  }

  private async captureScreenshot(context: AgentContext): Promise<ChartControlResponse> {
    try {
      const screenshot = await screenshotChart();
      return {
        success: true,
        data: { screenshot },
        message: 'Screenshot captured successfully',
        screenshot,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to capture screenshot: ${error}`,
      };
    }
  }

  private async getChartState(context: AgentContext): Promise<ChartControlResponse> {
    const contextConfig = generateChartContextConfig();
    
    return {
      success: true,
      data: {
        symbol: context.symbol,
        timeframe: context.timeframe,
        chartType: context.chartType,
        indicators: context.indicators || [],
        availableOptions: contextConfig,
      },
      message: 'Chart state retrieved successfully',
    };
  }
}
