/**
 * Utility functions for creating overlays programmatically with KLineCharts Pro
 */

export interface OverlayPoint {
  timestamp?: number;
  value: number;
}

export interface OverlayStyles {
  line?: {
    color?: string;
    size?: number;
    style?: "solid" | "dashed" | "dotted";
  };
  text?: {
    color?: string;
    size?: number;
    family?: string;
    weight?: string;
    offset?: [number, number];
  };
  polygon?: {
    color?: string;
  };
}

export interface CreateOverlayOptions {
  name: string;
  points: OverlayPoint[];
  styles?: OverlayStyles;
  text?: string;
  lock?: boolean;
  id?: string;
}

/**
 * Create a segment (line) overlay between two points
 */
export function createSegmentOverlay(
  startPoint: OverlayPoint,
  endPoint: OverlayPoint,
  color: string = "#00D4AA",
  lineWidth: number = 2
): CreateOverlayOptions {
  return {
    name: "segment",
    points: [startPoint, endPoint],
    styles: {
      line: {
        color,
        size: lineWidth,
        style: "solid",
      },
    },
    lock: true,
  };
}

/**
 * Create a horizontal ray line at a specific price level
 */
export function createHorizontalRayOverlay(
  priceLevel: number,
  timestamp?: number,
  color: string = "#00D4AA",
  label?: string
): CreateOverlayOptions {
  return {
    name: "horizontalRayLine",
    points: [
      {
        timestamp: timestamp || Date.now(),
        value: priceLevel,
      },
    ],
    styles: {
      line: {
        color,
        size: 2,
        style: "solid",
      },
      text: {
        color,
        size: 12,
        family: "Arial",
        weight: "bold",
        offset: [5, 0],
      },
    },
    text: label || `$${priceLevel.toFixed(2)}`,
    lock: true,
  };
}

/**
 * Create a vertical line at a specific timestamp
 */
export function createVerticalLineOverlay(
  timestamp: number,
  color: string = "#00D4AA",
  label?: string
): CreateOverlayOptions {
  return {
    name: "verticalStraightLine",
    points: [
      {
        timestamp,
        value: 0, // Value doesn't matter for vertical lines
      },
    ],
    styles: {
      line: {
        color,
        size: 2,
        style: "solid",
      },
      text: {
        color,
        size: 12,
        family: "Arial",
        weight: "bold",
        offset: [5, 0],
      },
    },
    text: label,
    lock: true,
  };
}

/**
 * Create a rectangle overlay
 */
export function createRectangleOverlay(
  topLeft: OverlayPoint,
  bottomRight: OverlayPoint,
  color: string = "#00D4AA",
  fillColor?: string
): CreateOverlayOptions {
  return {
    name: "rect",
    points: [topLeft, bottomRight],
    styles: {
      line: {
        color,
        size: 1,
        style: "solid",
      },
      polygon: {
        color: fillColor || `${color}20`, // 20% opacity
      },
    },
    lock: true,
  };
}

/**
 * Create a circle overlay
 */
export function createCircleOverlay(
  center: OverlayPoint,
  radiusPoint: OverlayPoint,
  color: string = "#00D4AA",
  fillColor?: string
): CreateOverlayOptions {
  return {
    name: "circle",
    points: [center, radiusPoint],
    styles: {
      line: {
        color,
        size: 1,
        style: "solid",
      },
      polygon: {
        color: fillColor || `${color}20`,
      },
    },
    lock: true,
  };
}

/**
 * Create a Fibonacci retracement overlay
 */
export function createFibonacciRetracementOverlay(
  startPoint: OverlayPoint,
  endPoint: OverlayPoint,
  color: string = "#00D4AA"
): CreateOverlayOptions {
  return {
    name: "fibonacciSegment",
    points: [startPoint, endPoint],
    styles: {
      line: {
        color,
        size: 1,
        style: "dashed",
      },
      text: {
        color,
        size: 10,
        family: "Arial",
        weight: "normal",
      },
    },
    lock: true,
  };
}

/**
 * Create a trend line overlay
 */
export function createTrendLineOverlay(
  startPoint: OverlayPoint,
  endPoint: OverlayPoint,
  color: string = "#00D4AA",
  extend: boolean = true
): CreateOverlayOptions {
  return {
    name: extend ? "straightLine" : "segment",
    points: [startPoint, endPoint],
    styles: {
      line: {
        color,
        size: 2,
        style: "solid",
      },
    },
    lock: true,
  };
}

/**
 * Create an arrow overlay
 */
export function createArrowOverlay(
  startPoint: OverlayPoint,
  endPoint: OverlayPoint,
  color: string = "#00D4AA"
): CreateOverlayOptions {
  return {
    name: "arrow",
    points: [startPoint, endPoint],
    styles: {
      line: {
        color,
        size: 2,
        style: "solid",
      },
    },
    lock: true,
  };
}

/**
 * Create a price channel overlay
 */
export function createPriceChannelOverlay(
  upperStart: OverlayPoint,
  upperEnd: OverlayPoint,
  lowerStart: OverlayPoint,
  lowerEnd: OverlayPoint,
  color: string = "#00D4AA"
): CreateOverlayOptions[] {
  return [
    {
      name: "straightLine",
      points: [upperStart, upperEnd],
      styles: {
        line: {
          color,
          size: 1,
          style: "solid",
        },
      },
      lock: true,
    },
    {
      name: "straightLine",
      points: [lowerStart, lowerEnd],
      styles: {
        line: {
          color,
          size: 1,
          style: "solid",
        },
      },
      lock: true,
    },
  ];
}

/**
 * Create support/resistance levels
 */
export function createSupportResistanceLevels(
  levels: number[],
  color: string = "#00D4AA",
  timestamp?: number
): CreateOverlayOptions[] {
  const currentTime = timestamp || Date.now();

  return levels.map((level, index) => ({
    name: "horizontalStraightLine",
    points: [
      {
        timestamp: currentTime,
        value: level,
      },
    ],
    styles: {
      line: {
        color,
        size: 1,
        style: "dashed",
      },
      text: {
        color,
        size: 10,
        family: "Arial",
        weight: "normal",
        offset: [5, 0],
      },
    },
    text: `Level ${index + 1}: $${level.toFixed(2)}`,
    lock: true,
    id: `level_${index}_${level}`,
  }));
}

/**
 * Predefined overlay configurations for common trading patterns
 */
export const TRADING_OVERLAYS = {
  /**
   * Create a bullish flag pattern
   */
  bullishFlag: (
    poleStart: OverlayPoint,
    poleEnd: OverlayPoint,
    flagStart: OverlayPoint,
    flagEnd: OverlayPoint
  ): CreateOverlayOptions[] => [
    createTrendLineOverlay(poleStart, poleEnd, "#00D4AA", false),
    createTrendLineOverlay(flagStart, flagEnd, "#FFE66D", false),
  ],

  /**
   * Create a head and shoulders pattern
   */
  headAndShoulders: (
    leftShoulder: OverlayPoint,
    head: OverlayPoint,
    rightShoulder: OverlayPoint,
    necklineStart: OverlayPoint,
    necklineEnd: OverlayPoint
  ): CreateOverlayOptions[] => [
    createSegmentOverlay(leftShoulder, head, "#FF6B6B"),
    createSegmentOverlay(head, rightShoulder, "#FF6B6B"),
    createTrendLineOverlay(necklineStart, necklineEnd, "#4ECDC4", true),
  ],

  /**
   * Create a triangle pattern
   */
  triangle: (
    upperTrendStart: OverlayPoint,
    upperTrendEnd: OverlayPoint,
    lowerTrendStart: OverlayPoint,
    lowerTrendEnd: OverlayPoint
  ): CreateOverlayOptions[] => [
    createTrendLineOverlay(upperTrendStart, upperTrendEnd, "#00D4AA", true),
    createTrendLineOverlay(lowerTrendStart, lowerTrendEnd, "#00D4AA", true),
  ],
};

/**
 * Helper function to convert price and time to overlay points
 */
export function createPoint(
  timestamp: number | Date,
  price: number
): OverlayPoint {
  return {
    timestamp: timestamp instanceof Date ? timestamp.getTime() : timestamp,
    value: price,
  };
}

/**
 * Helper function to get current timestamp
 */
export function getCurrentTimestamp(): number {
  return Date.now();
}

/**
 * Helper function to get timestamp for days ago
 */
export function getDaysAgoTimestamp(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

/**
 * Helper function to get timestamp for hours ago
 */
export function getHoursAgoTimestamp(hours: number): number {
  return Date.now() - hours * 60 * 60 * 1000;
}
