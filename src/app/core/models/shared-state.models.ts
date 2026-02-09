/**
 * Shared state context synced bi-directionally between Angular and ADK agent
 * Enables reliable multi-turn drill-downs and conversational context
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

/**
 * State of the current visualization
 */
export interface VisualizationState {
  /** Type of chart being displayed */
  chartType: string;

  /** Title of the visualization */
  title: string;

  /** Reference to the A2UI component node ID */
  a2uiNodeId: string;

  /** SQL query that produced this visualization */
  sourceQuery: string;

  /** Metadata about the data shape */
  dataShape: {
    rows: number;
    columns: string[];
  };

  /** Whether drill-down interactions are enabled */
  interactive: boolean;
}

/**
 * Information about a database query
 */
export interface QueryState {
  /** The SQL query that was executed */
  sql: string;

  /** Database that was queried */
  database: string;

  /** Number of rows returned */
  rowCount: number;

  /** Query execution time in milliseconds */
  executionTimeMs: number;

  /** Column names in the result set */
  columns: string[];
}
