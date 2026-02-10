import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

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

}
