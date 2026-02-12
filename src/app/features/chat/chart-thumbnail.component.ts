import { Component, ChangeDetectionStrategy, Input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { A2UISurface } from '../../core/models/a2ui.models';

/**
 * ChartThumbnailComponent
 *
 * Displays a compact preview of a chart in a message bubble.
 * Clicking opens the full visualization on the canvas.
 */
@Component({
  selector: 'app-chart-thumbnail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div
      class="mt-2 p-3 border border-gray-200 rounded-lg bg-gray-50 cursor-pointer hover:bg-gray-100 hover:border-blue-300 transition-all"
      (click)="viewOnCanvas.emit()">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-gray-700">{{ title || 'Visualization' }}</span>
        <span class="text-xs text-blue-600 flex items-center gap-1">
          View on canvas
          <svg
            class="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>

      <!-- Chart preview icon -->
      <div class="mt-2 h-20 bg-white rounded flex items-center justify-center border border-gray-100">
        <svg
          class="w-10 h-10 text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>

      @if (surface) {
        <p class="mt-2 text-xs text-gray-500">
          {{ surface.nodes.length }} component{{ surface.nodes.length !== 1 ? 's' : '' }}
        </p>
      }
    </div>
  `,
})
export class ChartThumbnailComponent {
  @Input() surface?: A2UISurface;
  @Input() title?: string;

  readonly viewOnCanvas = output<void>();
}
