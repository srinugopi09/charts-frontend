import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CatalogBaseComponent } from '../catalog-base.component';
import { FEATURE_FLAGS } from '../../core/config/feature-flags';

/**
 * KPICardComponent
 *
 * Displays a key performance indicator with optional trend information.
 * Features:
 * - Large value display with smart formatting (no double symbols)
 * - Trend arrow (up/down/neutral)
 * - Color-coded by status
 * - Click to drill down
 *
 * CRITICAL: Properties must be accessed via getProp() helper, NOT as class properties.
 * DynamicComponent stores props in component().properties, not on the instance.
 */
@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      (click)="handleClick()"
      role="button"
      tabindex="0"
      (keydown.enter)="handleClick()"
      [attr.aria-label]="label + ': ' + formattedValue"
      [class]="containerClasses">
      <!-- Label -->
      <div [class]="isModern ? 'text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3' : 'text-sm font-medium text-gray-600 mb-2'">
        {{ label }}
      </div>

      <!-- Value -->
      <div class="flex items-baseline gap-2 mb-3">
        <span [class]="isModern ? 'text-4xl font-extrabold text-gray-900 tracking-tight' : 'text-3xl font-bold text-gray-900'">
          {{ formattedValue }}
        </span>
        @if (shouldShowUnit) {
          <span [class]="isModern ? 'text-lg text-gray-400 font-medium' : 'text-lg text-gray-500'">{{ unit }}</span>
        }
      </div>

      <!-- Trend -->
      @if (trend && trendValue !== undefined) {
        <div [class]="isModern ? 'flex items-center gap-2 mt-1' : 'flex items-center gap-2'">
          @if (trend === 'up') {
            @if (isModern) {
              <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50">
                <svg class="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                <span class="text-sm font-semibold text-emerald-600">+{{ formattedTrendValue }}</span>
              </div>
            } @else {
              <svg class="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              <span class="text-sm font-medium text-green-600">+{{ formattedTrendValue }}</span>
            }
          } @else if (trend === 'down') {
            @if (isModern) {
              <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50">
                <svg class="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                <span class="text-sm font-semibold text-red-600">-{{ formattedTrendValue }}</span>
              </div>
            } @else {
              <svg class="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <span class="text-sm font-medium text-red-600">-{{ formattedTrendValue }}</span>
            }
          } @else {
            @if (isModern) {
              <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100">
                <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 12h14" />
                </svg>
                <span class="text-sm font-semibold text-gray-400">No change</span>
              </div>
            } @else {
              <svg class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14" />
              </svg>
              <span class="text-sm font-medium text-gray-400">No change</span>
            }
          }

          @if (trendPeriod) {
            <span [class]="isModern ? 'text-xs text-gray-400' : 'text-xs text-gray-500'">{{ trendPeriod }}</span>
          }
        </div>
      }

      <!-- Status Indicator -->
      @if (status) {
        <div [class]="isModern ? 'mt-4 pt-4 border-t border-gray-100' : 'mt-3 pt-3 border-t border-gray-100'">
          <div class="flex items-center gap-2">
            <div
              [class]="statusDotClass"
              class="w-2 h-2 rounded-full"></div>
            <span class="text-xs font-medium" [class]="statusTextClass">
              {{ statusLabel }}
            </span>
          </div>
        </div>
      }
    </div>
  `,
})
export class KPICardComponent extends CatalogBaseComponent {
  // Currency/prefix symbols that appear before the value
  private static readonly PREFIX_SYMBOLS = ['$', '£', '€', '¥', '₹'];
  // Suffix symbols that appear after the value
  private static readonly SUFFIX_SYMBOLS = ['%', 'pp', 'bps'];

  get isModern(): boolean {
    return FEATURE_FLAGS.MODERN_CHART_STYLE;
  }

  // Property getters via getProp pattern
  get label(): string {
    return this.getProp<string>('label', 'KPI')!;
  }

  get value(): number | string | undefined {
    return this.getProp<number | string>('value');
  }

  get unit(): string | undefined {
    return this.getProp<string>('unit');
  }

  get trend(): 'up' | 'down' | 'neutral' | undefined {
    return this.getProp<'up' | 'down' | 'neutral'>('trend');
  }

  get trendValue(): number | undefined {
    return this.getProp<number>('trendValue');
  }

  get trendPeriod(): string | undefined {
    return this.getProp<string>('trendPeriod');
  }

  get status(): 'red' | 'amber' | 'green' | undefined {
    return this.getProp<'red' | 'amber' | 'green'>('status');
  }

  /**
   * Format value for display, incorporating currency prefixes to avoid duplication.
   * - number + prefix unit ($): "$2,847"
   * - number + suffix unit (%): "95"
   * - number + no unit: "2,847"
   * - string (pre-formatted): returned as-is
   */
  protected get formattedValue(): string {
    const val = this.value;
    if (val === undefined || val === null) return '—';

    // String values are assumed to be pre-formatted
    if (typeof val === 'string') return val;

    // Number: check if unit is a currency prefix
    const u = this.unit;
    if (u && KPICardComponent.PREFIX_SYMBOLS.includes(u)) {
      return `${u}${val.toLocaleString()}`;
    }

    return val.toLocaleString();
  }

  /**
   * Whether to display the unit separately after the value.
   * Returns false if:
   * - No unit defined
   * - Unit is a prefix symbol (already baked into formattedValue)
   * - Value is a string that already contains the unit
   */
  protected get shouldShowUnit(): boolean {
    const u = this.unit;
    if (!u) return false;

    // Prefix symbols are already included in formattedValue
    if (KPICardComponent.PREFIX_SYMBOLS.includes(u)) return false;

    // String value that already contains the unit
    const val = this.value;
    if (typeof val === 'string' && val.includes(u)) return false;

    return true;
  }

  /**
   * Format trend value with appropriate unit placement.
   * - Currency prefix: "$1,200"
   * - Suffix (%): "5.2%"
   * - Other/none: "1,200"
   */
  protected get formattedTrendValue(): string {
    const tv = this.trendValue;
    if (tv === undefined) return '';

    const abs = Math.abs(tv);
    const u = this.unit;

    if (u && KPICardComponent.PREFIX_SYMBOLS.includes(u)) {
      return `${u}${abs.toLocaleString()}`;
    }
    if (u && KPICardComponent.SUFFIX_SYMBOLS.includes(u)) {
      return `${abs.toLocaleString()}${u}`;
    }
    return abs.toLocaleString();
  }

  /**
   * Get full container classes including modern/classic styling
   */
  protected get containerClasses(): string {
    if (this.isModern) {
      const statusAccent: Record<string, string> = {
        red: 'border-l-red-500',
        amber: 'border-l-amber-500',
        green: 'border-l-emerald-500',
      };
      const accent = this.status ? statusAccent[this.status] : 'border-l-indigo-500';
      return `p-6 bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 ${accent} hover:shadow-md transition-all duration-150 cursor-pointer`;
    }

    const statusMap: Record<string, string> = {
      red: 'border-red-300 hover:border-red-400',
      amber: 'border-amber-300 hover:border-amber-400',
      green: 'border-green-300 hover:border-green-400',
    };
    const border = this.status ? statusMap[this.status] : 'border-gray-200 hover:border-gray-300';
    return `p-6 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer ${border}`;
  }

  protected get statusDotClass(): string {
    const statusMap: Record<string, string> = {
      red: 'bg-red-500',
      amber: 'bg-amber-500',
      green: 'bg-green-500',
    };
    return this.status ? statusMap[this.status] : 'bg-gray-400';
  }

  protected get statusTextClass(): string {
    const statusMap: Record<string, string> = {
      red: 'text-red-700',
      amber: 'text-amber-700',
      green: 'text-green-700',
    };
    return this.status ? statusMap[this.status] : 'text-gray-600';
  }

  protected get statusLabel(): string {
    const statusMap: Record<string, string> = {
      red: 'Needs Attention',
      amber: 'Warning',
      green: 'On Track',
    };
    return this.status ? statusMap[this.status] : 'Normal';
  }

  /**
   * Handle card click - emit drill-down action using correct A2UI format
   */
  protected handleClick(): void {
    this.sendAction({
      name: 'drill_down',
      context: [
        { key: 'label', value: { literalString: this.label } },
        { key: 'value', value: { literalString: String(this.value ?? '') } },
      ],
    } as any);
  }
}
