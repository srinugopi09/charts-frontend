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
