import { Component, ChangeDetectionStrategy, input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SplitViewComponent } from '../layout/split-view.component';

/**
 * CanvasToolbarComponent
 *
 * Toolbar for the canvas panel with chart title and controls.
 * Features:
 * - Display current visualization title
 * - History dropdown (future enhancement)
 */
@Component({
  selector: 'app-canvas-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="h-16 border-b border-gray-200 bg-gradient-to-r from-white to-gray-50 px-6 flex items-center justify-between shadow-sm">
      <!-- Left: Title with icon -->
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md">
          <svg
            class="w-6 h-6 text-white"
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
        <div>
          <h2 class="text-lg font-bold text-gray-900 truncate">
            {{ title() || 'Visualization' }}
          </h2>
          <p class="text-xs text-gray-500">Interactive data visualization</p>
        </div>
      </div>

      <!-- Right: Controls with better styling -->
      <div class="flex items-center gap-2">
        <!-- Fullscreen toggle (desktop only) -->
        @if (splitView) {
          <button
            class="hidden lg:block p-2.5 text-gray-500 hover:bg-white hover:text-blue-600 rounded-xl transition-all duration-200 hover:shadow-md"
            [title]="splitView.isCanvasFullscreen() ? 'Exit fullscreen' : 'Fullscreen'"
            (click)="splitView.toggleCanvasFullscreen()">
            @if (splitView.isCanvasFullscreen()) {
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
            } @else {
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            }
          </button>
        }

        <!-- History Dropdown (placeholder) -->
        <button
          class="p-2.5 text-gray-500 hover:bg-white hover:text-blue-600 rounded-xl transition-all duration-200 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          title="View history"
          [disabled]="true">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

      </div>
    </div>
  `,
})
export class CanvasToolbarComponent {
  readonly title = input<string>('');
  protected readonly splitView = inject(SplitViewComponent, { optional: true });
}
