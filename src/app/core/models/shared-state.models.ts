/**
 * Shared state context synced bi-directionally between Angular and ADK agent.
 * Shape is defined here but populated by the agent via STATE_DELTA events.
 */
export interface AgentContext {
  /** Current visualization displayed on canvas */
  currentVisualization: VisualizationState | null;

  /** Last SQL query executed by the agent */
  lastQuery: QueryState | null;

  /** Active filters applied by the user */
  activeFilters: Record<string, any>;

  /** Active data source identifier */
  dataSource: string;

  /** Agent's understanding of the conversation goal */
  conversationIntent: string | null;
}

/** State of the current visualization (populated by agent) */
export interface VisualizationState {
  chartType: string;
  title: string;
  a2uiNodeId: string;
  sourceQuery: string;
  dataShape: { rows: number; columns: string[] };
  interactive: boolean;
}

/** Information about a database query (populated by agent) */
export interface QueryState {
  sql: string;
  database: string;
  rowCount: number;
  executionTimeMs: number;
  columns: string[];
}
