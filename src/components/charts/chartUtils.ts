/**
 * Utility functions for chart operations
 */

/**
 * Add horizontal ray line at specific price level
 * This function matches your original signature and can be used with any chart widget instance
 *
 * @param widget - The chart widget instance (should have addHorizontalRayLineAtLevel method)
 * @param priceLevel - The price level where to draw the horizontal ray line
 * @param timestamp - Optional timestamp for time-based anchoring (defaults to current time)
 * @param color - Optional color for the line (defaults to chart theme color)
 * @param label - Optional label for the line
 */
export function addHorizontalRayLineAtLevel(
  widget: any,
  priceLevel: number,
  timestamp?: number,
  color?: string,
  label?: string
) {
  if (!widget) {
    console.error("Widget not available");
    return;
  }

  const currentTime = timestamp || Date.now();

  // If the widget has the addHorizontalRayLineAtLevel method (our KLineProChart)
  if (
    widget.addHorizontalRayLineAtLevel &&
    typeof widget.addHorizontalRayLineAtLevel === "function"
  ) {
    widget.addHorizontalRayLineAtLevel(priceLevel, currentTime, color, label);
    return;
  }

  // If it's a direct chart instance with createOverlay method
  if (widget.createOverlay && typeof widget.createOverlay === "function") {
    try {
      widget.createOverlay({
        name: "horizontalRayLine",
        points: [
          {
            timestamp: currentTime,
            value: priceLevel,
          },
        ],
        styles: {
          line: {
            color: color || "#00D4AA",
            size: 2,
            style: "solid",
          },
          text: {
            color: color || "#00D4AA",
            size: 12,
            family: "Arial",
            weight: "bold",
          },
        },
        text: label || `Ray Line $${priceLevel.toFixed(2)}`,
      });
    } catch (error) {
      console.error("Failed to create horizontal ray line:", error);
    }
    return;
  }

  console.error("Widget does not support horizontal ray line creation");
}

/**
 * Usage examples:
 *
 * // With KLineProChart ref
 * addHorizontalRayLineAtLevel(chartRef.current, 45000);
 *
 * // With specific timestamp
 * addHorizontalRayLineAtLevel(chartRef.current, 55000, 1640995200000);
 *
 * // With custom styling
 * addHorizontalRayLineAtLevel(chartRef.current, 150, Date.now(), '#FF5252', 'Resistance');
 */

/**
 * Batch add multiple horizontal ray lines
 */
export function addMultipleRayLines(
  widget: any,
  levels: Array<{
    price: number;
    timestamp?: number;
    color?: string;
    label?: string;
  }>
) {
  if (!widget) {
    console.error("Widget not available");
    return;
  }

  levels.forEach((level) => {
    addHorizontalRayLineAtLevel(
      widget,
      level.price,
      level.timestamp,
      level.color,
      level.label
    );
  });
}

/**
 * Add support and resistance levels
 */
export function addSupportResistanceLevels(
  widget: any,
  supportLevel: number,
  resistanceLevel: number,
  timestamp?: number
) {
  addHorizontalRayLineAtLevel(
    widget,
    supportLevel,
    timestamp,
    "#4CAF50",
    "Support"
  );

  addHorizontalRayLineAtLevel(
    widget,
    resistanceLevel,
    timestamp,
    "#FF5252",
    "Resistance"
  );
}
