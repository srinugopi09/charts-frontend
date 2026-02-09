/**
 * Feature Flags
 *
 * Central toggle for experimental or in-progress features.
 * Flip a boolean here to enable/disable across the entire app.
 */
export const FEATURE_FLAGS = {
  /** When true, chart/KPI/table clicks trigger drill-down follow-up queries to the agent. */
  DRILL_DOWN_ENABLED: false,
  /** When true, bar charts use modern styling (rounded corners, formatted axes, refined colors). */
  MODERN_CHART_STYLE: true,
} as const;
