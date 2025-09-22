import {
  executeChartActionsSequentially,
  screenshotChart,
  ChartAction,
} from "./chartBridge";
import {
  normalizeIndicatorOptions,
  IndicatorProfile,
} from "./indicatorDefaults";
import {
  showOverlayMessage,
  hideOverlayMessage,
  onOverlayCancel,
  offOverlayCancel,
  onOverlayContinue,
  offOverlayContinue,
} from "../services/overlayBus";

export type SequenceStep =
  | { kind: "timeframe"; timeframe: string; message?: string }
  | { kind: "chartType"; chartType: string; message?: string }
  | {
      kind: "indicator";
      indicator: string;
      options?: any;
      profile?: IndicatorProfile;
      message?: string;
    }
  | { kind: "navigate"; direction: "left" | "right"; message?: string }
  | { kind: "toggleOption"; option: string; enabled: boolean; message?: string }
  | {
      kind: "line"; // placeholder for future drawing tools
      message?: string;
    }
  | {
      kind: "label"; // placeholder for label updates
      message?: string;
    }
  | { kind: "screenshot"; message?: string }
  | { kind: "delay"; ms: number; message?: string }
  | {
      kind: "layout";
      layoutId: string;
      timeframe?: string;
      profile?: IndicatorProfile;
      message?: string;
      screenshotAfter?: boolean;
    };

export type SequenceResult = {
  ok: boolean;
  screenshots?: string[];
  cancelled?: boolean;
};

export type RunSequenceOptions = {
  profile?: IndicatorProfile;
  onStep?: (index: number, step: SequenceStep) => void;
  narrate?: boolean;
  cancellable?: boolean;
  perStepDelayMs?: number | ((index: number, step: SequenceStep) => number);
  requireContinue?: boolean | ((index: number, step: SequenceStep) => boolean);
};

export async function runChartSequence(
  steps: SequenceStep[],
  opts: RunSequenceOptions = {}
): Promise<SequenceResult> {
  const {
    profile,
    onStep,
    narrate = true,
    cancellable = true,
    perStepDelayMs,
    requireContinue,
  } = opts;
  const screenshots: string[] = [];
  let cancelled = false;

  const cancelHandler = () => {
    cancelled = true;
  };
  if (cancellable) onOverlayCancel(cancelHandler);
  const continueWaiters: Array<() => void> = [];
  const continueHandler = () => {
    const fn = continueWaiters.shift();
    if (fn) fn();
  };
  onOverlayContinue(continueHandler);

  try {
    for (let i = 0; i < steps.length; i++) {
      if (cancelled) break;
      const step = steps[i];
      if (narrate && step.message) showOverlayMessage(step.message);
      onStep?.(i, step);

      // pacing
      const delay =
        typeof perStepDelayMs === "function"
          ? perStepDelayMs(i, step)
          : perStepDelayMs;
      const mustContinue =
        typeof requireContinue === "function"
          ? requireContinue(i, step)
          : requireContinue;
      if (delay && delay > 0) await new Promise((r) => setTimeout(r, delay));
      if (mustContinue) {
        await new Promise<void>((resolve) => {
          continueWaiters.push(resolve);
          if (narrate && step.message) showOverlayMessage(step.message, true);
        });
      }

      let actions: ChartAction[] = [];
      switch (step.kind) {
        case "timeframe":
          actions.push({ type: "setTimeframe", timeframe: step.timeframe });
          break;
        case "chartType":
          actions.push({
            type: "setChartType",
            chartType: step.chartType,
          } as any);
          break;
        case "indicator": {
          const normalized = normalizeIndicatorOptions(
            step.indicator,
            step.options,
            step.profile ?? profile
          );
          actions.push({
            type: "addIndicator",
            indicator: step.indicator,
            options: normalized,
          });
          break;
        }
        case "navigate":
          actions.push({ type: "navigate", direction: step.direction });
          break;
        case "toggleOption":
          actions.push({
            type: "toggleDisplayOption",
            option: step.option,
            enabled: step.enabled,
          } as any);
          break;
        case "line":
        case "label":
          // Not yet implemented in chart bridge; skip gracefully
          break;
        case "screenshot": {
          const shot = await screenshotChart();
          screenshots.push(shot);
          break;
        }
        case "delay": {
          await new Promise((r) => setTimeout(r, step.ms));
          break;
        }
        case "layout": {
          // layout is a higher-level sequence; handled by caller via translation
          break;
        }
      }

      if (actions.length) {
        await executeChartActionsSequentially(actions);
      }
    }
  } finally {
    if (cancellable) offOverlayCancel(cancelHandler);
    offOverlayContinue(continueHandler);
    if (narrate) hideOverlayMessage();
  }

  return { ok: !cancelled, screenshots, cancelled };
}
