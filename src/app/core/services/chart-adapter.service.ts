import { Injectable } from '@angular/core';

/**
 * ChartAdapterService
 *
 * Resolves which charting library renders a given chart type.
 * Provides pluggable abstraction over Chart.js and future rendering engines.
 */
@Injectable({
  providedIn: 'root',
})
export class ChartAdapterService {
  private rendererMap = new Map<string, string>();

  constructor() {
    this.registerDefaultRenderers();
  }

  /**
   * Get the renderer for a given chart type
   */
  getRenderer(chartType: string): string {
    return this.rendererMap.get(chartType) || 'chartjs';
  }

  /**
   * Register a custom renderer for a chart type
   */
  registerRenderer(chartType: string, renderer: string): void {
    this.rendererMap.set(chartType, renderer);
  }

  /**
   * Register default Chart.js renderers for all supported chart types
   */
  private registerDefaultRenderers(): void {
    const chartTypes = [
      'bar',
      'line',
      'pie',
      'doughnut',
      'area',
      'radar',
      'scatter',
      'horizontalBar',
      'stackedBar',
      'stackedArea',
    ];

    chartTypes.forEach((type) => this.rendererMap.set(type, 'chartjs'));
  }
}
