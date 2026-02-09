/**
 * A2UI surface containing a tree of component nodes
 */
export interface A2UISurface {
  /** Array of component nodes in the surface */
  nodes: A2UINode[];

  /** ID of the root node */
  rootNodeId: string;
}

/**
 * A single component node in the A2UI tree
 */
export interface A2UINode {
  /** Unique identifier for this node */
  id: string;

  /** Component type (matches catalog registration) */
  type: string;

  /** Properties passed to the component */
  props: Record<string, any>;

  /** Optional array of child node IDs */
  children?: string[];
}

/**
 * Chart data structure for Chart.js
 */
export interface ChartData {
  /** Array of labels for the x-axis */
  labels: string[];

  /** Array of datasets to display */
  datasets: ChartDataset[];
}

/**
 * A single dataset in a chart
 */
export interface ChartDataset {
  /** Label for this dataset */
  label: string;

  /** Array of data values */
  data: number[];

  /** Background color(s) for the dataset */
  backgroundColor?: string | string[];

  /** Border color for the dataset */
  borderColor?: string;

  /** Additional Chart.js dataset options */
  [key: string]: any;
}

/**
 * Supported chart types
 */
export type ChartType =
  | 'bar'
  | 'line'
  | 'pie'
  | 'doughnut'
  | 'area'
  | 'radar'
  | 'scatter'
  | 'horizontalBar'
  | 'stackedBar'
  | 'stackedArea';

/**
 * Action emitted when user interacts with a chart
 */
export interface DrillDownAction {
  /** Action type */
  type: 'drill_down';

  /** Label of the clicked element */
  label: string;

  /** Value of the clicked element */
  value: number;

  /** Dataset label (if applicable) */
  datasetLabel?: string;
}

/**
 * Column definition for data tables
 */
export interface ColumnDef {
  /** Column identifier */
  key: string;

  /** Display label for the column header */
  label: string;

  /** Data type for formatting and sorting */
  type: 'string' | 'number' | 'date' | 'status' | 'currency';

  /** Text alignment */
  align?: 'left' | 'center' | 'right';
}
