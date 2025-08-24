/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { registerOverlay } from "klinecharts";

import overlays from "./extension";

import DefaultDatafeed from "./DefaultDatafeed";
import KLineChartPro from "./KLineChartPro";

import { load } from "./i18n";

import {
  Datafeed,
  SymbolInfo,
  Period,
  DatafeedSubscribeCallback,
  ChartProOptions,
  ChartPro,
} from "./types";

import "./index.less";

// Register all overlays automatically
overlays.forEach((o) => {
  registerOverlay(o);
});

// Export the main components
export { DefaultDatafeed, KLineChartPro, load as loadLocales };

// Export all overlay templates for direct use
export { default as overlays } from "./extension";

// Export individual overlay templates
export { default as arrow } from "./extension/arrow";
export { default as circle } from "./extension/circle";
export { default as rect } from "./extension/rect";
export { default as parallelogram } from "./extension/parallelogram";
export { default as triangle } from "./extension/triangle";
export { default as fibonacciCircle } from "./extension/fibonacciCircle";
export { default as fibonacciSegment } from "./extension/fibonacciSegment";
export { default as fibonacciSpiral } from "./extension/fibonacciSpiral";
export { default as fibonacciSpeedResistanceFan } from "./extension/fibonacciSpeedResistanceFan";
export { default as fibonacciExtension } from "./extension/fibonacciExtension";
export { default as gannBox } from "./extension/gannBox";
export { default as threeWaves } from "./extension/threeWaves";
export { default as fiveWaves } from "./extension/fiveWaves";
export { default as eightWaves } from "./extension/eightWaves";
export { default as anyWaves } from "./extension/anyWaves";
export { default as abcd } from "./extension/abcd";
export { default as xabcd } from "./extension/xabcd";

// Export overlay utilities
export * from "./extension/utils";

// Export all types
export type {
  Datafeed,
  SymbolInfo,
  Period,
  DatafeedSubscribeCallback,
  ChartProOptions,
  ChartPro,
};

// Re-export commonly used KLineCharts types for convenience
export type {
  OverlayTemplate,
  Coordinate,
  OverlayCreate,
  OverlayMode,
  LineAttrs,
  TextAttrs,
  CircleAttrs,
  PolygonAttrs,
  KLineData,
  Styles,
  DeepPartial,
  utils,
} from "klinecharts";
