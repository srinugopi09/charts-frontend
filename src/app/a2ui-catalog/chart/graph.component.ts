import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  effect,
} from '@angular/core';
import { Chart, ChartConfiguration, ChartType as ChartJsType } from 'chart.js/auto';
import { CatalogBaseComponent } from '../catalog-base.component';
import { ChartType, ChartData } from '../../core/models/a2ui.models';
import { FEATURE_FLAGS } from '../../core/config/feature-flags';

/**
 * GraphComponent
 *
 * Universal chart renderer using Chart.js.
 * Supports all chart types: bar, line, pie, scatter, bubble, radar, polar, doughnut.
 *
 * CRITICAL: Always destroy Chart.js instance before recreating to prevent memory leaks.
 *
 * Features:
 * - Colorblind-safe palettes
 * - Interactive drill-downs via click events
 * - Responsive sizing
 * - Uses ChartAdapterService for renderer selection
 */
@Component({
  selector: 'app-graph',
  standalone: true,
  template: `
    <div class="w-full flex flex-col p-4" [style.min-height]="isModernStyled ? '600px' : '300px'">
      <div class="relative w-full flex-1 min-h-0">
        <canvas #chartCanvas role="img" [attr.aria-label]="'Chart: ' + (title || graphType || 'visualization')"></canvas>
      </div>
    </div>
  `,
})
export class GraphComponent extends CatalogBaseComponent implements AfterViewInit, OnDestroy {
  private static readonly MODERN_PALETTE = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#7c3aed'];

  @ViewChild('chartCanvas', { static: false }) canvasRef?: ElementRef<HTMLCanvasElement>;

  private chartInstance: Chart | null = null;
  private viewReady = false;

  constructor() {
    super();
    // Re-render chart when A2UI properties change (e.g., drill-down updates data)
    effect(() => {
      // Read reactive signals to establish dependency tracking
      const props = this.component().properties;
      // Only re-render if the view is ready (canvas exists)
      if (this.viewReady && props) {
        this.renderChart();
      }
    });
  }

  // Helper getters to access properties from component signal
  get graphType(): ChartType | undefined {
    return this.getProp<ChartType>('graphType');
  }

  get title(): string | undefined {
    return this.getProp<string>('title');
  }

  get data(): ChartData | undefined {
    return this.getProp<ChartData>('data');
  }

  get xLabel(): string | undefined {
    return this.getProp<string>('xLabel');
  }

  get yLabel(): string | undefined {
    return this.getProp<string>('yLabel');
  }

  get valuePrefix(): string {
    return this.getProp<string>('valuePrefix', '')!;
  }

  get valueSuffix(): string {
    return this.getProp<string>('valueSuffix', '')!;
  }

  get interactive(): boolean {
    if (!FEATURE_FLAGS.DRILL_DOWN_ENABLED) return false;
    return this.getProp<boolean>('interactive', true)!;
  }

  get showLegend(): boolean {
    return this.getProp<boolean>('showLegend', true)!;
  }

  get colorScheme(): 'default' | 'sequential' | 'diverging' | 'status' | 'categorical' {
    return this.getProp<any>('colorScheme', 'default')!;
  }

  ngAfterViewInit(): void {
    console.log('GraphComponent ngAfterViewInit - interactive:', this.interactive, 'graphType:', this.graphType);
    this.viewReady = true;
    this.renderChart();
  }

  ngOnDestroy(): void {
    // CRITICAL: Destroy chart instance to prevent memory leaks
    this.destroyChart();
  }

  get isModernBar(): boolean {
    return FEATURE_FLAGS.MODERN_CHART_STYLE && (this.graphType === 'bar' || this.graphType === 'horizontalBar');
  }

  get isHorizontalBar(): boolean {
    return this.graphType === 'horizontalBar';
  }

  get isModernStackedBar(): boolean {
    return FEATURE_FLAGS.MODERN_CHART_STYLE && this.graphType === 'stackedBar';
  }

  get isModernLine(): boolean {
    return FEATURE_FLAGS.MODERN_CHART_STYLE && (this.graphType === 'line' || this.graphType === 'area');
  }

  get isModernPie(): boolean {
    return FEATURE_FLAGS.MODERN_CHART_STYLE && (this.graphType === 'pie' || this.graphType === 'doughnut');
  }

  get isModernStyled(): boolean {
    return FEATURE_FLAGS.MODERN_CHART_STYLE;
  }

  /**
   * Render or update the chart
   */
  private renderChart(): void {
    if (!this.canvasRef || !this.data || !this.graphType) {
      console.warn('GraphComponent: Missing required data or canvas reference');
      return;
    }

    // Destroy existing chart before creating new one
    this.destroyChart();

    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Map A2UI chart type to Chart.js type
    const chartType = this.mapToChartJsType(this.graphType);

    let config: ChartConfiguration;
    if (this.isModernBar || this.isModernStackedBar) {
      config = this.buildModernBarConfig(chartType, ctx);
    } else if (this.isModernLine) {
      config = this.buildModernLineConfig(chartType, ctx);
    } else if (this.isModernPie) {
      config = this.buildModernPieConfig(chartType);
    } else {
      config = this.buildClassicConfig(chartType);
    }

    // Create new chart instance
    this.chartInstance = new Chart(ctx, config);
  }

  /**
   * Classic chart configuration (original styling)
   */
  private buildClassicConfig(chartType: ChartJsType): ChartConfiguration {
    return {
      type: chartType,
      data: {
        labels: this.data!.labels || [],
        datasets: this.data!.datasets.map((dataset, index) => ({
          label: dataset.label,
          data: dataset.data,
          backgroundColor: this.getColors(index, this.data!.datasets.length, 0.6),
          borderColor: this.getColors(index, this.data!.datasets.length, 1),
          borderWidth: 2,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: this.showLegend,
            position: 'top',
          },
          tooltip: {
            enabled: true,
          },
        },
        scales: this.buildScales(chartType),
        onClick: this.interactive ? (event, elements) => this.handleChartClick(event, elements) : undefined,
      },
    };
  }

  /**
   * Modern bar chart configuration — refined styling behind MODERN_CHART_STYLE flag
   */
  private buildModernBarConfig(chartType: ChartJsType, ctx: CanvasRenderingContext2D): ChartConfiguration {
    const labels = this.data!.labels || [];
    const isSingleDataset = this.data!.datasets.length === 1;
    const isStacked = this.graphType === 'stackedBar';
    const isHorizontal = this.isHorizontalBar;
    const modernPalette = GraphComponent.MODERN_PALETTE;

    const formatValue = this.formatCompactValue.bind(this);

    // Inline plugin: renders data labels next to each bar
    const barDataLabelsPlugin = {
      id: 'barDataLabels',
      afterDatasetsDraw(chart: any) {
        const { ctx: drawCtx } = chart;
        chart.data.datasets.forEach((dataset: any, dsIdx: number) => {
          const meta = chart.getDatasetMeta(dsIdx);
          meta.data.forEach((bar: any, idx: number) => {
            const value = dataset.data[idx];
            if (value == null) return;
            const label = formatValue(value);
            drawCtx.save();
            drawCtx.font = "600 12px 'Inter', sans-serif";
            drawCtx.fillStyle = '#374151';
            if (isHorizontal) {
              // Position label to the right of the bar
              drawCtx.textAlign = 'left';
              drawCtx.textBaseline = 'middle';
              drawCtx.fillText(label, bar.x + 8, bar.y);
            } else {
              // Position label above the bar
              drawCtx.textAlign = 'center';
              drawCtx.textBaseline = 'bottom';
              drawCtx.fillText(label, bar.x, bar.y - 8);
            }
            drawCtx.restore();
          });
        });
      },
    };

    return {
      type: chartType,
      data: {
        labels,
        datasets: this.data!.datasets.map((dataset, dsIndex) => {
          // Use horizontal or vertical gradient based on orientation
          const createGradient = isHorizontal
            ? (hex: string) => this.createHorizontalBarGradient(ctx, hex)
            : (hex: string) => this.createBarGradient(ctx, hex);

          // For single dataset: each bar gets a distinct color via array
          // For multi-dataset: each dataset gets one color
          const colors = isSingleDataset
            ? labels.map((_, i) => createGradient(modernPalette[i % modernPalette.length]))
            : createGradient(modernPalette[dsIndex % modernPalette.length]);

          return {
            label: dataset.label,
            data: dataset.data,
            backgroundColor: colors,
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 6,
            borderSkipped: false as const,
            barPercentage: 0.6,
            categoryPercentage: 0.7,
            hoverBackgroundColor: isSingleDataset
              ? labels.map((_, i) => modernPalette[i % modernPalette.length])
              : modernPalette[dsIndex % modernPalette.length],
          };
        }),
      },
      plugins: [barDataLabelsPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: isHorizontal ? ('y' as const) : ('x' as const),
        layout: {
          padding: isHorizontal
            ? { top: 8, right: 48, bottom: 8, left: 8 }
            : { top: 28, right: 16, bottom: 8, left: 8 },
        },
        plugins: {
          legend: {
            display: this.showLegend && (!isSingleDataset || isStacked),
            position: 'top',
            labels: {
              usePointStyle: true,
              pointStyle: 'rectRounded',
              padding: 20,
              font: { size: 12, family: "'Inter', sans-serif" },
              color: '#6b7280',
            },
          },
          tooltip: {
            enabled: true,
            backgroundColor: '#1f2937',
            titleColor: '#f9fafb',
            bodyColor: '#e5e7eb',
            titleFont: { size: 13, weight: 'bold' as const, family: "'Inter', sans-serif" },
            bodyFont: { size: 12, family: "'Inter', sans-serif" },
            padding: { top: 10, right: 14, bottom: 10, left: 14 },
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: (tooltipItem: any) => {
                const value = isHorizontal ? tooltipItem.parsed.x : tooltipItem.parsed.y;
                return `${tooltipItem.dataset.label}: ${this.formatCompactValue(value)}`;
              },
            },
          },
        },
        scales: isHorizontal
          ? {
              // Horizontal bar: X is the value axis, Y is the category axis
              x: {
                stacked: isStacked,
                title: { display: false },
                beginAtZero: true,
                grid: { color: '#f3f4f6' },
                border: { display: false },
                ticks: {
                  color: '#9ca3af',
                  font: { size: 11, family: "'Inter', sans-serif" },
                  padding: 8,
                  callback: (tickValue: string | number) => {
                    return this.formatCompactValue(Number(tickValue));
                  },
                },
              },
              y: {
                stacked: isStacked,
                title: { display: false },
                grid: { display: false },
                border: { display: false },
                ticks: {
                  color: '#6b7280',
                  font: { size: 12, family: "'Inter', sans-serif" },
                  padding: 8,
                },
              },
            }
          : {
              x: {
                stacked: isStacked,
                title: { display: false },
                grid: { display: false },
                border: { display: false },
                ticks: {
                  color: '#6b7280',
                  font: { size: 12, family: "'Inter', sans-serif" },
                  padding: 8,
                },
              },
              y: {
                stacked: isStacked,
                title: { display: false },
                beginAtZero: true,
                grid: { color: '#f3f4f6' },
                border: { display: false, dash: [4, 4] },
                ticks: {
                  color: '#9ca3af',
                  font: { size: 11, family: "'Inter', sans-serif" },
                  padding: 8,
                  callback: (tickValue: string | number) => {
                    return this.formatCompactValue(Number(tickValue));
                  },
                },
              },
            },
        onClick: this.interactive ? (event, elements) => this.handleChartClick(event, elements) : undefined,
      },
    };
  }

  /**
   * Modern line/area configuration — refined styling behind MODERN_CHART_STYLE flag
   */
  private buildModernLineConfig(chartType: ChartJsType, ctx: CanvasRenderingContext2D): ChartConfiguration {
    const modernPalette = GraphComponent.MODERN_PALETTE;
    const isArea = this.graphType === 'area';

    return {
      type: chartType,
      data: {
        labels: this.data!.labels || [],
        datasets: this.data!.datasets.map((dataset, dsIndex) => {
          const hex = modernPalette[dsIndex % modernPalette.length];
          const { r, g, b } = this.hexToRgb(hex);

          // Gradient fill under the line
          const fillGradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
          fillGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${isArea ? 0.35 : 0.15})`);
          fillGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.01)`);

          return {
            label: dataset.label,
            data: dataset.data,
            borderColor: hex,
            backgroundColor: fillGradient,
            borderWidth: 2.5,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: hex,
            pointBorderWidth: 2,
            pointHoverRadius: 7,
            pointHoverBackgroundColor: hex,
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 2.5,
          };
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { top: 8, right: 16, bottom: 8, left: 8 },
        },
        interaction: {
          mode: 'index' as const,
          intersect: false,
        },
        plugins: {
          legend: {
            display: this.showLegend && this.data!.datasets.length > 1,
            position: 'top',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 20,
              font: { size: 12, family: "'Inter', sans-serif" },
              color: '#6b7280',
            },
          },
          tooltip: {
            enabled: true,
            backgroundColor: '#1f2937',
            titleColor: '#f9fafb',
            bodyColor: '#e5e7eb',
            titleFont: { size: 13, weight: 'bold' as const, family: "'Inter', sans-serif" },
            bodyFont: { size: 12, family: "'Inter', sans-serif" },
            padding: { top: 10, right: 14, bottom: 10, left: 14 },
            cornerRadius: 8,
            displayColors: true,
            callbacks: {
              label: (tooltipItem: any) => {
                const value = tooltipItem.parsed.y;
                return ` ${tooltipItem.dataset.label}: ${this.formatCompactValue(value)}`;
              },
            },
          },
        },
        scales: {
          x: {
            title: { display: false },
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: '#6b7280',
              font: { size: 12, family: "'Inter', sans-serif" },
              padding: 8,
            },
          },
          y: {
            title: { display: false },
            beginAtZero: true,
            grid: { color: '#f3f4f6' },
            border: { display: false },
            ticks: {
              color: '#9ca3af',
              font: { size: 11, family: "'Inter', sans-serif" },
              padding: 8,
              callback: (tickValue: string | number) => {
                return this.formatCompactValue(Number(tickValue));
              },
            },
          },
        },
        onClick: this.interactive ? (event, elements) => this.handleChartClick(event, elements) : undefined,
      },
    };
  }

  /**
   * Modern pie/doughnut configuration — refined styling behind MODERN_CHART_STYLE flag
   */
  private buildModernPieConfig(chartType: ChartJsType): ChartConfiguration {
    const labels = this.data!.labels || [];
    const modernPalette = GraphComponent.MODERN_PALETTE;
    const formatValue = this.formatCompactValue.bind(this);

    // Compute total for percentage calculation
    const total = this.data!.datasets[0]?.data.reduce((sum, v) => sum + (v as number), 0) || 1;

    // Inline plugin: renders percentage labels on each slice
    const pieDataLabelsPlugin = {
      id: 'pieDataLabels',
      afterDatasetsDraw(chart: any) {
        const { ctx: drawCtx } = chart;
        const meta = chart.getDatasetMeta(0);
        if (!meta) return;

        meta.data.forEach((arc: any, idx: number) => {
          const value = chart.data.datasets[0].data[idx];
          if (value == null || value === 0) return;

          const pct = ((value / total) * 100).toFixed(1);
          // Position label at midpoint of the arc
          const { x, y } = arc.tooltipPosition();

          drawCtx.save();
          drawCtx.font = "bold 13px 'Inter', sans-serif";
          drawCtx.fillStyle = '#ffffff';
          drawCtx.textAlign = 'center';
          drawCtx.textBaseline = 'middle';
          // Drop shadow for readability on colored slices
          drawCtx.shadowColor = 'rgba(0, 0, 0, 0.3)';
          drawCtx.shadowBlur = 3;
          drawCtx.fillText(`${pct}%`, x, y);
          drawCtx.restore();
        });
      },
    };

    return {
      type: chartType,
      data: {
        labels,
        datasets: this.data!.datasets.map((dataset) => ({
          label: dataset.label,
          data: dataset.data,
          backgroundColor: labels.map((_, i) => modernPalette[i % modernPalette.length]),
          borderColor: '#ffffff',
          borderWidth: 3,
          hoverBorderColor: '#ffffff',
          hoverBorderWidth: 4,
          hoverOffset: 8,
        })),
      },
      plugins: [pieDataLabelsPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: 16,
        },
        plugins: {
          legend: {
            display: this.showLegend,
            position: 'bottom',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 20,
              font: { size: 12, family: "'Inter', sans-serif" },
              color: '#6b7280',
            },
          },
          tooltip: {
            enabled: true,
            backgroundColor: '#1f2937',
            titleColor: '#f9fafb',
            bodyColor: '#e5e7eb',
            titleFont: { size: 13, weight: 'bold' as const, family: "'Inter', sans-serif" },
            bodyFont: { size: 12, family: "'Inter', sans-serif" },
            padding: { top: 10, right: 14, bottom: 10, left: 14 },
            cornerRadius: 8,
            displayColors: true,
            callbacks: {
              label: (tooltipItem: any) => {
                const value = tooltipItem.parsed;
                const pct = ((value / total) * 100).toFixed(1);
                return ` ${tooltipItem.label}: ${formatValue(value)} (${pct}%)`;
              },
            },
          },
        },
        onClick: this.interactive ? (event, elements) => this.handleChartClick(event, elements) : undefined,
      },
    };
  }

  /**
   * Create a vertical gradient for a bar from a base color
   */
  private createBarGradient(ctx: CanvasRenderingContext2D, hex: string): CanvasGradient {
    const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    const { r, g, b } = this.hexToRgb(hex);
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.9)`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.4)`);
    return gradient;
  }

  private createHorizontalBarGradient(ctx: CanvasRenderingContext2D, hex: string): CanvasGradient {
    const gradient = ctx.createLinearGradient(0, 0, ctx.canvas.width, 0);
    const { r, g, b } = this.hexToRgb(hex);
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.4)`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.9)`);
    return gradient;
  }

  /**
   * Format large numbers compactly: 44500000 → "$44.5M"
   */
  private formatCompactValue(value: number): string {
    const prefix = this.valuePrefix;
    const suffix = this.valueSuffix;
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    let compact: string;
    if (abs >= 1_000_000_000) compact = `${(abs / 1_000_000_000).toFixed(1)}B`;
    else if (abs >= 1_000_000) compact = `${(abs / 1_000_000).toFixed(1)}M`;
    else if (abs >= 1_000) compact = `${(abs / 1_000).toFixed(1)}K`;
    else compact = `${abs}`;
    return `${sign}${prefix}${compact}${suffix}`;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  }

  /**
   * Destroy chart instance
   */
  private destroyChart(): void {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  }

  /**
   * Map A2UI chart type to Chart.js type
   */
  private mapToChartJsType(type: ChartType): ChartJsType {
    const typeMap: Partial<Record<ChartType, ChartJsType>> = {
      bar: 'bar',
      line: 'line',
      pie: 'pie',
      scatter: 'scatter',
      radar: 'radar',
      doughnut: 'doughnut',
      area: 'line',
      horizontalBar: 'bar',
      stackedBar: 'bar',
      stackedArea: 'line',
    };
    return typeMap[type] || 'bar';
  }

  /**
   * Build scales configuration based on chart type
   */
  private buildScales(chartType: ChartJsType): any {
    // Pie, doughnut, and radar charts don't use standard x/y scales
    if (['pie', 'doughnut', 'radar'].includes(chartType)) {
      return undefined;
    }

    return {
      x: {
        title: {
          display: !!this.xLabel,
          text: this.xLabel || '',
        },
      },
      y: {
        title: {
          display: !!this.yLabel,
          text: this.yLabel || '',
        },
        beginAtZero: true,
      },
    };
  }

  /**
   * Get colorblind-safe colors from Tailwind palette
   */
  private getColors(index: number, _total: number, alpha: number): string {
    const palettes = {
      default: ['#3b82f6', '#06b6d4', '#f97316', '#8b5cf6', '#ec4899', '#f59e0b'],
      sequential: ['#dbeafe', '#93c5fd', '#3b82f6', '#1e40af', '#1e3a8a'],
      diverging: ['#ef4444', '#f97316', '#fbbf24', '#a3e635', '#22c55e'],
      status: ['#22c55e', '#fbbf24', '#ef4444'],
      categorical: ['#3b82f6', '#ec4899', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316'],
    };

    const palette = palettes[this.colorScheme || 'default'];
    const color = palette[index % palette.length];

    // Convert hex to rgba with alpha
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * Handle chart click for drill-downs
   */
  private handleChartClick(_event: any, elements: any[]): void {
    console.log('Chart clicked!', { interactive: this.interactive, elementsLength: elements.length });

    if (!this.interactive || elements.length === 0) {
      console.log('Click ignored - interactive:', this.interactive, 'elements:', elements.length);
      return;
    }

    const element = elements[0];
    const datasetIndex = element.datasetIndex;
    const dataIndex = element.index;

    const dataset = this.data?.datasets[datasetIndex];
    const label = this.data?.labels?.[dataIndex];
    const value = dataset?.data[dataIndex];

    console.log('Emitting drill-down action:', { label, value, datasetLabel: dataset?.label });

    if (label !== undefined && value !== undefined) {
      // Send drill-down action via A2UI
      // Action interface requires 'name' and context as array of key-value pairs
      this.sendAction({
        name: 'drill_down',
        context: [
          { key: 'label', value: { literalString: String(label) } },
          { key: 'value', value: { literalNumber: value as number } },
          { key: 'datasetLabel', value: { literalString: dataset?.label || '' } },
        ],
      } as any);
    }
  }
}
