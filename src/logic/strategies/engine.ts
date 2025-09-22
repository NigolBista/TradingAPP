import {
  AIStrategyInput,
  AIStrategyOutput,
  runAIStrategy,
} from "../aiStrategyEngine";

export interface StrategyEngine {
  key: string; // e.g., "llm/default"
  run(input: AIStrategyInput): Promise<AIStrategyOutput | null>;
}

export class LLMStrategyEngine implements StrategyEngine {
  key = "llm/default";
  async run(input: AIStrategyInput): Promise<AIStrategyOutput | null> {
    return runAIStrategy(input);
  }
}

export class StrategyEngineRegistry {
  private static engines: Map<string, StrategyEngine> = new Map();
  static register(engine: StrategyEngine) {
    if (!this.engines.has(engine.key)) this.engines.set(engine.key, engine);
  }
  static get(key: string): StrategyEngine | undefined {
    return this.engines.get(key);
  }
  static getDefault(): StrategyEngine {
    return this.engines.get("llm/default") || new LLMStrategyEngine();
  }
}

// Register default engine
StrategyEngineRegistry.register(new LLMStrategyEngine());
