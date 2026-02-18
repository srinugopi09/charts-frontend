import {
  Component,
  ChangeDetectionStrategy,
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

// ── Shared modern chart theme ──────────────────────────────────

const MODERN_PALETTE = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#7c3aed'];

const FONT = "'Inter', sans-serif";

/** Shared tooltip config for all modern chart types */
const MODERN_TOOLTIP_BASE = {
  enabled: true,
  backgroundColor: '#1f2937',
  titleColor: '#f9fafb',
  bodyColor: '#e5e7eb',
  titleFont: { size: 13, weight: 'bold' as const, family: FONT },
  bodyFont: { size: 12, family: FONT },
  padding: { top: 10, right: 14, bottom: 10, left: 14 },
  cornerRadius: 8,
};

/** Shared legend label config for modern chart types */
const MODERN_LEGEND_LABELS = {
  padding: 20,
  font: { size: 12, family: FONT },
  color: '#6b7280',
};

/** Shared scale tick config for value axes */
const MODERN_VALUE_TICKS = {
  color: '#9ca3af',
  font: { size: 11, family: FONT },
  padding: 8,
};

/** Shared scale tick config for category axes */
const MODERN_CATEGORY_TICKS = {
  color: '#6b7280',
  font: { size: 12, family: FONT },
  padding: 8,
};

// ── Chart type mapping ─────────────────────────────────────────

const CHART_TYPE_MAP: Partial<Record<ChartType, ChartJsType>> = {
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

// ── Color palettes ─────────────────────────────────────────────

const COLOR_PALETTES: Record<string, string[]> = {
  default: ['#3b82f6', '#06b6d4', '#f97316', '#8b5cf6', '#ec4899', '#f59e0b'],
  sequential: ['#dbeafe', '#93c5fd', '#3b82f6', '#1e40af', '#1e3a8a'],
  diverging: ['#ef4444', '#f97316', '#fbbf24', '#a3e635', '#22c55e'],
  status: ['#22c55e', '#fbbf24', '#ef4444'],
  categorical: ['#3b82f6', '#ec4899', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316'],
};

// ── Helper functions ───────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * GraphComponent
 *
 * Universal chart renderer using Chart.js.
 * Supports: bar, line, pie, scatter, bubble, radar, polar, doughnut.
 *
 * CRITICAL: Always destroy Chart.js instance before recreating to prevent memory leaks.
 */
@Component({
  selector: 'app-graph',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="w-full flex flex-col p-4" [style.min-height]="isModernStyled ? '600px' : '300px'">
      <div class="relative w-full flex-1 min-h-0">
        <canvas #chartCanvas role="img" [attr.aria-label]="'Chart: ' + (title || graphType || 'visualization')"></canvas>
      </div>
    </div>
  `,
})
export class GraphComponent extends CatalogBaseComponent implements AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas', { static: false }) canvasRef?: ElementRef<HTMLCanvasElement>;

  private chartInstance: Chart | null = null;
  private viewReady = false;

  constructor() {
    super();
    effect(() => {
      const props = this.component().properties;
      if (this.viewReady && props) {
        this.renderChart();
      }
    });
  }

  // Property getters
  get graphType(): ChartType | undefined { return this.getProp<ChartType>('graphType'); }
  get title(): string | undefined { return this.getProp<string>('title'); }
  get data(): ChartData | undefined { return this.getProp<ChartData>('data'); }
  get xLabel(): string | undefined { return this.getProp<string>('xLabel'); }
  get yLabel(): string | undefined { return this.getProp<string>('yLabel'); }
  get valuePrefix(): string { return this.getProp<string>('valuePrefix', '')!; }
  get valueSuffix(): string { return this.getProp<string>('valueSuffix', '')!; }
  get showLegend(): boolean { return this.getProp<boolean>('showLegend', true)!; }
  get colorScheme(): string { return this.getProp<string>('colorScheme', 'default')!; }

  get interactive(): boolean {
    if (!FEATURE_FLAGS.DRILL_DOWN_ENABLED) return false;
    return this.getProp<boolean>('interactive', true)!;
  }

  get isHorizontalBar(): boolean { return this.graphType === 'horizontalBar'; }
  get isModernBar(): boolean { return FEATURE_FLAGS.MODERN_CHART_STYLE && (this.graphType === 'bar' || this.graphType === 'horizontalBar'); }
  get isModernStackedBar(): boolean { return FEATURE_FLAGS.MODERN_CHART_STYLE && this.graphType === 'stackedBar'; }
  get isModernLine(): boolean { return FEATURE_FLAGS.MODERN_CHART_STYLE && (this.graphType === 'line' || this.graphType === 'area'); }
  get isModernPie(): boolean { return FEATURE_FLAGS.MODERN_CHART_STYLE && (this.graphType === 'pie' || this.graphType === 'doughnut'); }
  get isModernStyled(): boolean { return FEATURE_FLAGS.MODERN_CHART_STYLE; }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderChart();
  }

  ngOnDestroy(): void {
    this.destroyChart();
  }

  private renderChart(): void {
    if (!this.canvasRef || !this.data || !this.graphType) return;

    this.destroyChart();

    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const chartType = CHART_TYPE_MAP[this.graphType] || 'bar';

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

    this.chartInstance = new Chart(ctx, config);
  }

  private buildClassicConfig(chartType: ChartJsType): ChartConfiguration {
    return {
      type: chartType,
      data: {
        labels: this.data!.labels || [],
        datasets: this.data!.datasets.map((dataset, index) => ({
          label: dataset.label,
          data: dataset.data,
          backgroundColor: this.getClassicColor(index, 0.6),
          borderColor: this.getClassicColor(index, 1),
          borderWidth: 2,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: this.showLegend, position: 'top' },
          tooltip: { enabled: true },
        },
        scales: this.buildClassicScales(chartType),
        onClick: this.interactive ? (_event, elements) => this.handleChartClick(elements) : undefined,
      },
    };
  }

  private buildModernBarConfig(chartType: ChartJsType, ctx: CanvasRenderingContext2D): ChartConfiguration {
    const labels = this.data!.labels || [];
    const isSingleDataset = this.data!.datasets.length === 1;
    const isStacked = this.graphType === 'stackedBar';
    const isHorizontal = this.isHorizontalBar;

    const formatValue = this.formatCompactValue.bind(this);

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
            drawCtx.font = `600 12px ${FONT}`;
            drawCtx.fillStyle = '#374151';
            if (isHorizontal) {
              drawCtx.textAlign = 'left';
              drawCtx.textBaseline = 'middle';
              drawCtx.fillText(label, bar.x + 8, bar.y);
            } else {
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
          const createGradient = isHorizontal
            ? (hex: string) => this.createGradient(ctx, hex, 'horizontal')
            : (hex: string) => this.createGradient(ctx, hex, 'vertical');

          const colors = isSingleDataset
            ? labels.map((_, i) => createGradient(MODERN_PALETTE[i % MODERN_PALETTE.length]))
            : createGradient(MODERN_PALETTE[dsIndex % MODERN_PALETTE.length]);

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
              ? labels.map((_, i) => MODERN_PALETTE[i % MODERN_PALETTE.length])
              : MODERN_PALETTE[dsIndex % MODERN_PALETTE.length],
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
            labels: { ...MODERN_LEGEND_LABELS, usePointStyle: true, pointStyle: 'rectRounded' },
          },
          tooltip: {
            ...MODERN_TOOLTIP_BASE,
            displayColors: false,
            callbacks: {
              label: (tooltipItem: any) => {
                const value = isHorizontal ? tooltipItem.parsed.x : tooltipItem.parsed.y;
                return `${tooltipItem.dataset.label}: ${this.formatCompactValue(value)}`;
              },
            },
          },
        },
        scales: this.buildModernScales(isHorizontal, isStacked),
        onClick: this.interactive ? (_event, elements) => this.handleChartClick(elements) : undefined,
      },
    };
  }

  private buildModernLineConfig(chartType: ChartJsType, ctx: CanvasRenderingContext2D): ChartConfiguration {
    const isArea = this.graphType === 'area';

    return {
      type: chartType,
      data: {
        labels: this.data!.labels || [],
        datasets: this.data!.datasets.map((dataset, dsIndex) => {
          const hex = MODERN_PALETTE[dsIndex % MODERN_PALETTE.length];
          const { r, g, b } = hexToRgb(hex);

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
        layout: { padding: { top: 8, right: 16, bottom: 8, left: 8 } },
        interaction: { mode: 'index' as const, intersect: false },
        plugins: {
          legend: {
            display: this.showLegend && this.data!.datasets.length > 1,
            position: 'top',
            labels: { ...MODERN_LEGEND_LABELS, usePointStyle: true, pointStyle: 'circle' },
          },
          tooltip: {
            ...MODERN_TOOLTIP_BASE,
            displayColors: true,
            callbacks: {
              label: (tooltipItem: any) => {
                return ` ${tooltipItem.dataset.label}: ${this.formatCompactValue(tooltipItem.parsed.y)}`;
              },
            },
          },
        },
        scales: {
          x: { title: { display: false }, grid: { display: false }, border: { display: false }, ticks: MODERN_CATEGORY_TICKS },
          y: { title: { display: false }, beginAtZero: true, grid: { color: '#f3f4f6' }, border: { display: false }, ticks: { ...MODERN_VALUE_TICKS, callback: (v: string | number) => this.formatCompactValue(Number(v)) } },
        },
        onClick: this.interactive ? (_event, elements) => this.handleChartClick(elements) : undefined,
      },
    };
  }

  private buildModernPieConfig(chartType: ChartJsType): ChartConfiguration {
    const labels = this.data!.labels || [];
    const formatValue = this.formatCompactValue.bind(this);
    const total = this.data!.datasets[0]?.data.reduce((sum, v) => sum + (v as number), 0) || 1;

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
          const { x, y } = arc.tooltipPosition();

          drawCtx.save();
          drawCtx.font = `bold 13px ${FONT}`;
          drawCtx.fillStyle = '#ffffff';
          drawCtx.textAlign = 'center';
          drawCtx.textBaseline = 'middle';
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
          backgroundColor: labels.map((_, i) => MODERN_PALETTE[i % MODERN_PALETTE.length]),
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
        layout: { padding: 16 },
        plugins: {
          legend: {
            display: this.showLegend,
            position: 'bottom',
            labels: { ...MODERN_LEGEND_LABELS, usePointStyle: true, pointStyle: 'circle' },
          },
          tooltip: {
            ...MODERN_TOOLTIP_BASE,
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
        onClick: this.interactive ? (_event, elements) => this.handleChartClick(elements) : undefined,
      },
    };
  }

  // ── Shared helpers ───────────────────────────────────────────

  private createGradient(ctx: CanvasRenderingContext2D, hex: string, direction: 'vertical' | 'horizontal'): CanvasGradient {
    const gradient = direction === 'horizontal'
      ? ctx.createLinearGradient(0, 0, ctx.canvas.width, 0)
      : ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    const { r, g, b } = hexToRgb(hex);
    if (direction === 'horizontal') {
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.4)`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.9)`);
    } else {
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.9)`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.4)`);
    }
    return gradient;
  }

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

  private destroyChart(): void {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  }

  private buildClassicScales(chartType: ChartJsType): any {
    if (['pie', 'doughnut', 'radar'].includes(chartType)) return undefined;
    return {
      x: { title: { display: !!this.xLabel, text: this.xLabel || '' } },
      y: { title: { display: !!this.yLabel, text: this.yLabel || '' }, beginAtZero: true },
    };
  }

  private buildModernScales(isHorizontal: boolean, isStacked: boolean): any {
    if (isHorizontal) {
      return {
        x: { stacked: isStacked, title: { display: false }, beginAtZero: true, grid: { color: '#f3f4f6' }, border: { display: false }, ticks: { ...MODERN_VALUE_TICKS, callback: (v: string | number) => this.formatCompactValue(Number(v)) } },
        y: { stacked: isStacked, title: { display: false }, grid: { display: false }, border: { display: false }, ticks: MODERN_CATEGORY_TICKS },
      };
    }
    return {
      x: { stacked: isStacked, title: { display: false }, grid: { display: false }, border: { display: false }, ticks: MODERN_CATEGORY_TICKS },
      y: { stacked: isStacked, title: { display: false }, beginAtZero: true, grid: { color: '#f3f4f6' }, border: { display: false, dash: [4, 4] }, ticks: { ...MODERN_VALUE_TICKS, callback: (v: string | number) => this.formatCompactValue(Number(v)) } },
    };
  }

  private getClassicColor(index: number, alpha: number): string {
    const palette = COLOR_PALETTES[this.colorScheme] || COLOR_PALETTES['default'];
    return hexToRgba(palette[index % palette.length], alpha);
  }

  private handleChartClick(elements: any[]): void {
    if (!this.interactive || elements.length === 0) return;

    const element = elements[0];
    const dataset = this.data?.datasets[element.datasetIndex];
    const label = this.data?.labels?.[element.index];
    const value = dataset?.data[element.index];

    if (label !== undefined && value !== undefined) {
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
