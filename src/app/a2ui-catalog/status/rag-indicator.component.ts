import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CatalogBaseComponent } from '../catalog-base.component';

type RagStatus = 'green' | 'amber' | 'red';

/** Consolidated status configuration: circle, dot, badge classes + label */
const STATUS_CONFIG: Record<RagStatus, { circle: string; dot: string; badge: string; label: string }> = {
  green: { circle: 'border-green-400 bg-green-50', dot: 'bg-green-500', badge: 'bg-green-100 text-green-800', label: 'On Track' },
  amber: { circle: 'border-amber-400 bg-amber-50', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-800', label: 'At Risk' },
  red:   { circle: 'border-red-400 bg-red-50',     dot: 'bg-red-500',   badge: 'bg-red-100 text-red-800',     label: 'Critical' },
};

/**
 * RAGIndicatorComponent
 *
 * Displays a Red/Amber/Green status indicator with title, details, and metric value.
 *
 * CRITICAL: Properties accessed via getProp() from component().properties.
 */
@Component({
  selector: 'app-rag-indicator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
      <!-- Status circle with dot -->
      <div class="flex items-center gap-3 mb-3">
        <div [class]="cfg.circle" class="w-10 h-10 rounded-full border-2 flex items-center justify-center">
          <div [class]="cfg.dot" class="w-3 h-3 rounded-full"></div>
        </div>
        <div class="flex-1">
          <h4 class="text-sm font-semibold text-gray-900">{{ title || 'Status' }}</h4>
          <span [class]="cfg.badge" class="inline-block px-2 py-0.5 text-xs font-medium rounded mt-1">
            {{ cfg.label }}
          </span>
        </div>
      </div>

      <!-- Metric value -->
      @if (metricValue !== undefined) {
        <div class="text-2xl font-bold text-gray-900 mb-1">
          {{ metricValue }}{{ metricUnit ? ' ' + metricUnit : '' }}
        </div>
      }

      <!-- Details -->
      @if (details) {
        <p class="text-sm text-gray-600 mt-2">{{ details }}</p>
      }
    </div>
  `,
})
export class RagIndicatorComponent extends CatalogBaseComponent {
  get title(): string | undefined { return this.getProp<string>('title'); }
  get status(): RagStatus { return this.getProp<RagStatus>('status', 'green')!; }
  get details(): string | undefined { return this.getProp<string>('details'); }
  get metricValue(): number | undefined { return this.getProp<number>('metricValue'); }
  get metricUnit(): string | undefined { return this.getProp<string>('metricUnit'); }

  /** Resolved config for the current status */
  get cfg() { return STATUS_CONFIG[this.status] || STATUS_CONFIG['green']; }
}
