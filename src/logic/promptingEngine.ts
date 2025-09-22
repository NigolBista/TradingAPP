import { inferIntent, UserIntent } from "./intentEngine";
import { runChartSequence, SequenceStep } from "./chartSequenceEngine";
import { StrategyEngineRegistry } from "./strategies/engine";

export type ExecuteRequestOptions = {
  symbol?: string;
};

export async function executeUserRequest(
  message: string,
  options: ExecuteRequestOptions = {}
): Promise<{ reply: string; screenshots?: string[]; analysis?: any }> {
  const intent: UserIntent = await inferIntent(message, {
    symbol: options.symbol,
  });

  if (intent.type === "chart_analysis") {
    const steps: SequenceStep[] = (intent.sequence || []).map((s) => {
      if (s.kind === "timeframe")
        return {
          kind: "timeframe",
          timeframe: s.args?.timeframe,
          message: s.message,
        } as any;
      if (s.kind === "indicator")
        return {
          kind: "indicator",
          indicator: s.args?.indicator,
          options: s.args?.options,
          message: s.message,
        } as any;
      if (s.kind === "navigate")
        return {
          kind: "navigate",
          direction: s.args?.direction,
          message: s.message,
        } as any;
      if (s.kind === "toggleOption")
        return {
          kind: "toggleOption",
          option: s.args?.option,
          enabled: !!s.args?.enabled,
          message: s.message,
        } as any;
      if (s.kind === "screenshot")
        return { kind: "screenshot", message: s.message } as any;
      return { kind: "screenshot" } as any;
    });
    const result = await runChartSequence(steps, {
      profile: intent.profile || "day_trade",
      narrate: true,
      cancellable: false,
    });
    let analysis: any | undefined;
    if (intent.needsStrategy) {
      const engine = StrategyEngineRegistry.getDefault();
      analysis = await engine.run({
        symbol: intent.symbol,
        mode: "auto",
        candleData: {} as any,
        context: {},
      });
    }
    return {
      reply: "Done.",
      screenshots: result.screenshots,
      analysis,
    };
  }

  if (intent.type === "strategy_recommendation") {
    const engine = StrategyEngineRegistry.getDefault();
    const analysis = await engine.run({
      symbol: intent.symbol || options.symbol || "AAPL",
      mode: "auto",
      candleData: {} as any,
      context: { complexity: "advanced" },
    });
    return {
      reply: analysis ? "Strategy prepared." : "No strategy.",
      analysis,
    };
  }

  return {
    reply: "I can help with chart analysis or strategy recommendations.",
  };
}
