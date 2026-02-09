import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CatalogBaseComponent } from '../catalog-base.component';

/**
 * RAGIndicatorComponent
 *
 * Red/Amber/Green status indicator.
 * Features:
 * - Color-coded circle indicator
 * - Status label and detail text
 * - Optional metric and threshold display
 * - Click to request more details
 *
 * CRITICAL: Properties accessed via getProp() from component().properties.
 */
@Component({
  selector: 'app-rag-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      (click)="handleClick()"
      class="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer">
      <div class="flex items-start gap-4">
        <!-- Status Circle -->
        <div class="flex-shrink-0 mt-1">
          <div
            [class]="statusCircleClass"
            class="w-12 h-12 rounded-full flex items-center justify-center">
            <div [class]="statusDotClass" class="w-6 h-6 rounded-full"></div>
          </div>
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <!-- Label -->
          <h4 class="text-sm font-semibold text-gray-900 mb-1">
            {{ label }}
          </h4>

          <!-- Detail -->
          @if (detail) {
            <p class="text-sm text-gray-600 mb-2">{{ detail }}</p>
          }

          <!-- Metric and Threshold -->
          @if (metric !== undefined && threshold !== undefined) {
            <div class="flex items-baseline gap-2 text-xs">
              <span class="font-medium text-gray-700">{{ metric }}</span>
              <span class="text-gray-500">/</span>
              <span class="text-gray-500">{{ threshold }} threshold</span>
            </div>
          }

          <!-- Status Label -->
          <div class="mt-2">
            <span [class]="statusBadgeClass" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
              {{ statusLabel }}
            </span>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class RAGIndicatorComponent extends CatalogBaseComponent {
  // Property getters via getProp pattern
  get label(): string {
    return this.getProp<string>('label', 'Status')!;
  }

  get status(): 'red' | 'amber' | 'green' {
    return this.getProp<'red' | 'amber' | 'green'>('status', 'green')!;
  }

  get detail(): string | undefined {
    return this.getProp<string>('detail');
  }

  get metric(): number | undefined {
    return this.getProp<number>('metric');
  }

  get threshold(): number | undefined {
    return this.getProp<number>('threshold');
  }

  protected get statusCircleClass(): string {
    const statusMap: Record<string, string> = {
      red: 'bg-red-100',
      amber: 'bg-amber-100',
      green: 'bg-green-100',
    };
    return statusMap[this.status];
  }

  protected get statusDotClass(): string {
    const statusMap: Record<string, string> = {
      red: 'bg-red-500',
      amber: 'bg-amber-500',
      green: 'bg-green-500',
    };
    return statusMap[this.status];
  }

  protected get statusBadgeClass(): string {
    const statusMap: Record<string, string> = {
      red: 'bg-red-100 text-red-800',
      amber: 'bg-amber-100 text-amber-800',
      green: 'bg-green-100 text-green-800',
    };
    return statusMap[this.status];
  }

  protected get statusLabel(): string {
    const statusMap: Record<string, string> = {
      red: 'Critical',
      amber: 'Warning',
      green: 'Healthy',
    };
    return statusMap[this.status];
  }

  protected handleClick(): void {
    this.sendAction({
      name: 'detail_request',
      context: [
        { key: 'label', value: { literalString: this.label } },
        { key: 'status', value: { literalString: this.status } },
      ],
    } as any);
  }
}
