import { Agent, AgentContext, AgentResponse, AgentCapability } from './types';
import { generateChartContextConfig, isValidColor, isValidTimeframe, isValidChartType } from '../features/trading/services/chartContextConfig';

export class ChartContextAgent implements Agent {
  name = 'chart-context';
  description = 'Manages chart configuration and context information';
  
  capabilities: AgentCapability[] = [
    {
      name: 'get-chart-context',
      description: 'Get comprehensive chart context configuration',
      parameters: {},
    },
    {
      name: 'validate-chart-option',
      description: 'Validate chart options like colors, timeframes, chart types',
      parameters: {
        optionType: { type: 'string', enum: ['color', 'timeframe', 'chartType'] },
        value: { type: 'string' }
      },
    },
    {
      name: 'get-available-options',
      description: 'Get available options for specific chart elements',
      parameters: {
        elementType: { type: 'string', enum: ['colors', 'timeframes', 'indicators', 'chartTypes', 'lineStyles'] }
      },
    },
    {
      name: 'get-indicator-info',
      description: 'Get detailed information about a specific indicator',
      parameters: {
        indicatorName: { type: 'string' }
      },
    }
  ];

  async execute(context: AgentContext, action: string, params?: any): Promise<AgentResponse> {
    try {
      switch (action) {
        case 'get-chart-context':
          return this.getChartContext();
        
        case 'validate-chart-option':
          return this.validateChartOption(params?.optionType, params?.value);
        
        case 'get-available-options':
          return this.getAvailableOptions(params?.elementType);
        
        case 'get-indicator-info':
          return this.getIndicatorInfo(params?.indicatorName);
        
        default:
          return {
            success: false,
            error: `Unknown action: ${action}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `Chart context agent error: ${error}`,
      };
    }
  }

  canHandle(action: string): boolean {
    return this.capabilities.some(cap => cap.name === action);
  }

  getRequiredContext(): string[] {
    return ['symbol'];
  }

  private async getChartContext(): Promise<AgentResponse> {
    const contextConfig = generateChartContextConfig();
    return {
      success: true,
      data: contextConfig,
      message: 'Chart context configuration retrieved successfully',
    };
  }

  private async validateChartOption(optionType: string, value: string): Promise<AgentResponse> {
    let isValid = false;
    let message = '';

    switch (optionType) {
      case 'color':
        isValid = isValidColor(value);
        message = isValid ? 'Valid color' : 'Invalid color';
        break;
      case 'timeframe':
        isValid = isValidTimeframe(value);
        message = isValid ? 'Valid timeframe' : 'Invalid timeframe';
        break;
      case 'chartType':
        isValid = isValidChartType(value);
        message = isValid ? 'Valid chart type' : 'Invalid chart type';
        break;
      default:
        return {
          success: false,
          error: 'Unknown option type',
        };
    }

    return {
      success: true,
      data: { isValid, value, optionType },
      message,
    };
  }

  private async getAvailableOptions(elementType: string): Promise<AgentResponse> {
    const contextConfig = generateChartContextConfig();
    let options: any[] = [];

    switch (elementType) {
      case 'colors':
        options = [...contextConfig.colorPalette];
        break;
      case 'timeframes':
        options = [...contextConfig.timeframes];
        break;
      case 'indicators':
        options = [...contextConfig.availableIndicators];
        break;
      case 'chartTypes':
        options = [...contextConfig.chartTypes];
        break;
      case 'lineStyles':
        options = [...contextConfig.lineStyles];
        break;
      default:
        return {
          success: false,
          error: 'Unknown element type',
        };
    }

    return {
      success: true,
      data: options,
      message: `Available ${elementType} retrieved successfully`,
    };
  }

  private async getIndicatorInfo(indicatorName: string): Promise<AgentResponse> {
    const contextConfig = generateChartContextConfig();
    const indicator = contextConfig.availableIndicators.find(
      (ind: any) => ind.name.toLowerCase() === indicatorName.toLowerCase()
    );

    if (!indicator) {
      return {
        success: false,
        error: `Indicator '${indicatorName}' not found`,
      };
    }

    return {
      success: true,
      data: indicator,
      message: `Indicator information for '${indicatorName}' retrieved successfully`,
    };
  }
}
