import { executeChartActions, ChartAction } from "../features/trading/services/chartBridge";

/**
 * Dispatch chart actions originating from direct user interaction. By using
 * the same bridge and action executors as the LLM engine we ensure a unified
 * communication channel to the underlying chart implementation.
 */
export async function runUserChartActions(actions: ChartAction[]): Promise<void> {
  await executeChartActions(actions);
}
