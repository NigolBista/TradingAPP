import { captureChartScreenshot } from "../services/chartScreenshot";

// Unified chart actions that both user and LLM engines can dispatch
export type ChartAction =
  | { type: "setTimeframe"; timeframe: string }
  | { type: "addIndicator"; indicator: string; options?: Record<string, any> }
  | { type: "setLineColor"; color: string }
  | { type: "navigate"; direction: "left" | "right" }
  | { type: "checkNews" }
  | { type: "runAnalysis"; strategy?: string }
  | { type: "setChartType"; chartType: string }
  | { type: "toggleDisplayOption"; option: string; enabled: boolean };

// Bridge interface allowing actions to be executed on the actual charting UI
export interface ChartBridge {
  perform(action: ChartAction): Promise<void>;
}

let activeBridge: ChartBridge | null = null;

/**
 * Register a bridge that knows how to communicate with the chart. This bridge
 * should be used by any module that wants to control the chart (user driven or
 * LLM driven) so that all interactions go through a single pipeline.
 */
export function registerChartBridge(bridge: ChartBridge) {
  activeBridge = bridge;
}

/**
 * Unregister the currently active bridge. Typically used when the chart
 * component unmounts so that stale references are not retained.
 */
export function unregisterChartBridge() {
  activeBridge = null;
}

/**
 * Retrieve the currently registered bridge. Useful for advanced custom flows.
 */
export function getChartBridge(): ChartBridge | null {
  return activeBridge;
}

/**
 * Execute a single chart action via the registered bridge.
 */
export async function executeChartAction(action: ChartAction): Promise<void> {
  if (!activeBridge) {
    console.warn("Chart bridge not registered; skipping action", action);
    return;
  }
  await activeBridge.perform(action);
}

/**
 * Execute a sequence of chart actions.
 */
export async function executeChartActions(
  actions: ChartAction[]
): Promise<void> {
  await Promise.all(
    actions.map((action) =>
      executeChartAction(action).catch((e) =>
        console.warn("Chart action failed", e)
      )
    )
  );
}

/**
 * Capture a screenshot of the current chart using the screenshot service.
 */
export async function screenshotChart(): Promise<string> {
  return captureChartScreenshot();
}
