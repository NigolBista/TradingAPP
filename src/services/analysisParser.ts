import {
  ParsedAnalysis,
  TechnicalIndicator,
  TradeLevel,
  TradeZone,
  SupportResistanceLevel,
  ChartPattern,
} from "./chartAnalysisPrompt";

export class AnalysisParser {
  /**
   * Parse LLM response and extract XML-formatted analysis data
   */
  static parseAnalysisResponse(response: string): ParsedAnalysis {
    const result: ParsedAnalysis = {
      indicators: [],
      tradeLevels: [],
      tradeZones: [],
      supportResistance: [],
      patterns: [],
      textAnalysis: this.extractTextAnalysis(response),
    };

    try {
      // Parse indicators
      result.indicators = this.parseIndicators(response);

      // Parse trade levels
      result.tradeLevels = this.parseTradeLevels(response);

      // Parse trade zones
      result.tradeZones = this.parseTradeZones(response);

      // Parse support/resistance levels
      result.supportResistance = this.parseSupportResistance(response);

      // Parse patterns
      result.patterns = this.parsePatterns(response);
    } catch (error) {
      console.error("Error parsing analysis response:", error);
    }

    return result;
  }

  /**
   * Extract technical indicators from XML
   */
  private static parseIndicators(response: string): TechnicalIndicator[] {
    const indicators: TechnicalIndicator[] = [];
    const indicatorsMatch = response.match(
      /<indicators>([\s\S]*?)<\/indicators>/
    );

    if (indicatorsMatch) {
      const indicatorsXml = indicatorsMatch[1];
      const indicatorMatches = indicatorsXml.match(/<indicator[^>]*\/>/g);

      if (indicatorMatches) {
        indicatorMatches.forEach((match) => {
          const indicator = this.parseIndicatorAttributes(match);
          if (indicator) {
            indicators.push(indicator);
          }
        });
      }
    }

    return indicators;
  }

  /**
   * Parse individual indicator attributes
   */
  private static parseIndicatorAttributes(
    xml: string
  ): TechnicalIndicator | null {
    try {
      const type = this.extractAttribute(xml, "type");
      const color = this.extractAttribute(xml, "color") || "#00D4AA";

      if (!type) return null;

      const indicator: TechnicalIndicator = {
        type: type.toUpperCase(),
        color,
        parameters: {},
      };

      // Extract common parameters
      const period = this.extractAttribute(xml, "period");
      if (period) indicator.period = parseInt(period);

      // Extract specific parameters based on indicator type
      switch (type.toUpperCase()) {
        case "RSI":
          const overbought = this.extractAttribute(xml, "overbought");
          const oversold = this.extractAttribute(xml, "oversold");
          if (overbought)
            indicator.parameters!.overbought = parseInt(overbought);
          if (oversold) indicator.parameters!.oversold = parseInt(oversold);
          break;

        case "MACD":
          const fast = this.extractAttribute(xml, "fast");
          const slow = this.extractAttribute(xml, "slow");
          const signal = this.extractAttribute(xml, "signal");
          if (fast) indicator.parameters!.fast = parseInt(fast);
          if (slow) indicator.parameters!.slow = parseInt(slow);
          if (signal) indicator.parameters!.signal = parseInt(signal);
          break;

        case "BOLLINGER":
          const deviation = this.extractAttribute(xml, "deviation");
          if (deviation)
            indicator.parameters!.deviation = parseFloat(deviation);
          break;
      }

      return indicator;
    } catch (error) {
      console.error("Error parsing indicator:", error);
      return null;
    }
  }

  /**
   * Parse trade levels from XML
   */
  private static parseTradeLevels(response: string): TradeLevel[] {
    const levels: TradeLevel[] = [];
    const levelsMatch = response.match(
      /<trade_levels>([\s\S]*?)<\/trade_levels>/
    );

    if (levelsMatch) {
      const levelsXml = levelsMatch[1];

      // Parse different level types
      const levelTypes = ["entry", "exit", "stop_loss", "take_profit"];

      levelTypes.forEach((type) => {
        const regex = new RegExp(`<${type}[^>]*\/>`, "g");
        const matches = levelsXml.match(regex);

        if (matches) {
          matches.forEach((match) => {
            const level = this.parseLevelAttributes(match, type as any);
            if (level) {
              levels.push(level);
            }
          });
        }
      });
    }

    return levels;
  }

  /**
   * Parse individual trade level attributes
   */
  private static parseLevelAttributes(
    xml: string,
    type: "entry" | "exit" | "stop_loss" | "take_profit"
  ): TradeLevel | null {
    try {
      const price = this.extractAttribute(xml, "price");
      const color =
        this.extractAttribute(xml, "color") || this.getDefaultColor(type);
      const label =
        this.extractAttribute(xml, "label") ||
        type.replace("_", " ").toUpperCase();

      if (!price) return null;

      return {
        type,
        price: parseFloat(price),
        color,
        label,
        confidence: this.extractAttribute(xml, "confidence") || undefined,
        riskReward: this.extractAttribute(xml, "rr_ratio") || undefined,
      };
    } catch (error) {
      console.error("Error parsing trade level:", error);
      return null;
    }
  }

  /**
   * Parse trade zones from XML
   */
  private static parseTradeZones(response: string): TradeZone[] {
    const zones: TradeZone[] = [];
    const zonesMatch = response.match(/<trade_zones>([\s\S]*?)<\/trade_zones>/);

    if (zonesMatch) {
      const zonesXml = zonesMatch[1];
      const zoneMatches = zonesXml.match(/<zone[^>]*\/>/g);

      if (zoneMatches) {
        zoneMatches.forEach((match) => {
          const zone = this.parseZoneAttributes(match);
          if (zone) {
            zones.push(zone);
          }
        });
      }
    }

    return zones;
  }

  /**
   * Parse individual trade zone attributes
   */
  private static parseZoneAttributes(xml: string): TradeZone | null {
    try {
      const entryPrice = this.extractAttribute(xml, "entry_price");
      const exitPrice = this.extractAttribute(xml, "exit_price");
      const stopLoss = this.extractAttribute(xml, "stop_loss");
      const takeProfit = this.extractAttribute(xml, "take_profit");

      if (!entryPrice || !exitPrice || !stopLoss || !takeProfit) return null;

      return {
        entryPrice: parseFloat(entryPrice),
        exitPrice: parseFloat(exitPrice),
        stopLoss: parseFloat(stopLoss),
        takeProfit: parseFloat(takeProfit),
        startTime: this.extractAttribute(xml, "start_time") || undefined,
        endTime: this.extractAttribute(xml, "end_time") || undefined,
        type:
          (this.extractAttribute(xml, "type") as "long" | "short") || "long",
        color: this.extractAttribute(xml, "color") || "rgba(0, 212, 170, 0.2)",
        label: this.extractAttribute(xml, "label") || "Trade Zone",
        confidence: this.extractAttribute(xml, "confidence") || "0%",
        riskReward: this.extractAttribute(xml, "risk_reward") || "1:1",
      };
    } catch (error) {
      console.error("Error parsing trade zone:", error);
      return null;
    }
  }

  /**
   * Parse support/resistance levels from XML
   */
  private static parseSupportResistance(
    response: string
  ): SupportResistanceLevel[] {
    const levels: SupportResistanceLevel[] = [];
    const levelsMatch = response.match(/<levels>([\s\S]*?)<\/levels>/);

    if (levelsMatch) {
      const levelsXml = levelsMatch[1];
      const levelTypes = ["support", "resistance", "pivot"];

      levelTypes.forEach((type) => {
        const regex = new RegExp(`<${type}[^>]*\/>`, "g");
        const matches = levelsXml.match(regex);

        if (matches) {
          matches.forEach((match) => {
            const level = this.parseSRLevelAttributes(match, type as any);
            if (level) {
              levels.push(level);
            }
          });
        }
      });
    }

    return levels;
  }

  /**
   * Parse support/resistance level attributes
   */
  private static parseSRLevelAttributes(
    xml: string,
    type: "support" | "resistance" | "pivot"
  ): SupportResistanceLevel | null {
    try {
      const price = this.extractAttribute(xml, "price");
      const strength = this.extractAttribute(xml, "strength") as
        | "weak"
        | "moderate"
        | "strong";
      const label = this.extractAttribute(xml, "label");

      if (!price) return null;

      return {
        type,
        price: parseFloat(price),
        strength: strength || "moderate",
        label: label || type.toUpperCase(),
      };
    } catch (error) {
      console.error("Error parsing S/R level:", error);
      return null;
    }
  }

  /**
   * Parse chart patterns from XML
   */
  private static parsePatterns(response: string): ChartPattern[] {
    const patterns: ChartPattern[] = [];
    const patternsMatch = response.match(/<patterns>([\s\S]*?)<\/patterns>/);

    if (patternsMatch) {
      const patternsXml = patternsMatch[1];
      const patternMatches = patternsXml.match(/<pattern[^>]*\/>/g);

      if (patternMatches) {
        patternMatches.forEach((match) => {
          const pattern = this.parsePatternAttributes(match);
          if (pattern) {
            patterns.push(pattern);
          }
        });
      }
    }

    return patterns;
  }

  /**
   * Parse pattern attributes
   */
  private static parsePatternAttributes(xml: string): ChartPattern | null {
    try {
      const type = this.extractAttribute(xml, "type");
      const confidence = this.extractAttribute(xml, "confidence");
      const timeframe = this.extractAttribute(xml, "timeframe");
      const status = this.extractAttribute(xml, "status") as
        | "forming"
        | "confirmed"
        | "broken";

      if (!type || !confidence || !timeframe) return null;

      const pattern: ChartPattern = {
        type,
        confidence,
        timeframe,
        status: status || "forming",
      };

      const breakoutTarget = this.extractAttribute(xml, "breakout_target");
      if (breakoutTarget) {
        pattern.breakoutTarget = parseFloat(breakoutTarget);
      }

      return pattern;
    } catch (error) {
      console.error("Error parsing pattern:", error);
      return null;
    }
  }

  /**
   * Extract attribute value from XML string
   */
  private static extractAttribute(
    xml: string,
    attributeName: string
  ): string | null {
    const regex = new RegExp(`${attributeName}="([^"]*)"`, "i");
    const match = xml.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Extract text analysis (everything outside XML tags)
   */
  private static extractTextAnalysis(response: string): string {
    // Remove all XML blocks and clean up the remaining text
    let text = response
      .replace(/<indicators>[\s\S]*?<\/indicators>/g, "")
      .replace(/<trade_levels>[\s\S]*?<\/trade_levels>/g, "")
      .replace(/<trade_zones>[\s\S]*?<\/trade_zones>/g, "")
      .replace(/<levels>[\s\S]*?<\/levels>/g, "")
      .replace(/<patterns>[\s\S]*?<\/patterns>/g, "")
      .replace(/```xml[\s\S]*?```/g, "")
      .replace(/\n\s*\n/g, "\n")
      .trim();

    return text;
  }

  /**
   * Get default color for trade level types
   */
  private static getDefaultColor(type: string): string {
    const colors = {
      entry: "#00D4AA",
      exit: "#2196F3",
      stop_loss: "#FF5252",
      take_profit: "#4CAF50",
    };
    return colors[type as keyof typeof colors] || "#00D4AA";
  }

  /**
   * Convert parsed analysis to chart-compatible format
   */
  static toChartFormat(analysis: ParsedAnalysis) {
    // Convert trade levels to TradeLevel format for chart
    const tradeLevels = analysis.tradeLevels.map((level) => ({
      price: level.price,
      color: level.color,
      label: level.label,
      timestamp: Date.now(),
    }));

    // Convert trade zones to TradeZone format for chart
    const tradeZones = analysis.tradeZones.map((zone) => ({
      entryPrice: zone.entryPrice,
      exitPrice: zone.exitPrice,
      stopLoss: zone.stopLoss,
      takeProfit: zone.takeProfit,
      startTime: zone.startTime
        ? new Date(zone.startTime).getTime()
        : Date.now() - 86400000,
      endTime: zone.endTime
        ? new Date(zone.endTime).getTime()
        : Date.now() + 86400000,
      color: zone.color,
      label: zone.label,
      type: zone.type,
    }));

    return {
      tradeLevels,
      tradeZones,
      indicators: analysis.indicators,
      supportResistance: analysis.supportResistance,
      patterns: analysis.patterns,
      textAnalysis: analysis.textAnalysis,
    };
  }
}
