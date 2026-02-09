import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * LoadingSkeletonComponent
 *
 * Displays an animated skeleton loader for charts, tables, or cards.
 * Used while content is loading or streaming.
 */
@Component({
  selector: 'app-loading-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [style.height]="height" class="w-full" role="status" aria-label="Loading content">
      @if (type === 'chart') {
        <!-- Chart skeleton with modern shimmer effect -->
        <div class="space-y-4 animate-fadeIn">
          <!-- Title bar with gradient shimmer -->
          <div class="h-6 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-lg w-1/3 shadow-sm"></div>

          <!-- Chart area with gradient bars -->
          <div class="flex items-end justify-around h-64 space-x-2 p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-gray-100">
            @for (bar of [65, 45, 80, 55, 70, 40, 60]; track $index) {
              <div
                class="bg-gradient-to-t from-blue-200 via-blue-100 to-blue-50 bg-[length:100%_200%] animate-shimmer rounded-t-lg w-full shadow-sm"
                [style.height.%]="bar">
              </div>
            }
          </div>

          <!-- Legend with icon placeholders -->
          <div class="flex justify-center space-x-6">
            @for (item of [1, 2, 3]; track $index) {
              <div class="flex items-center space-x-2">
                <div class="w-4 h-4 bg-gradient-to-br from-purple-200 to-blue-200 rounded shadow-sm"></div>
                <div class="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded w-16"></div>
              </div>
            }
          </div>
        </div>
      }

      @if (type === 'table') {
        <!-- Table skeleton with modern styling -->
        <div class="space-y-3 animate-fadeIn">
          <!-- Header with gradient -->
          <div class="flex space-x-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-gray-100">
            @for (col of [1, 2, 3, 4]; track $index) {
              <div class="h-6 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded flex-1 shadow-sm"></div>
            }
          </div>

          <!-- Rows with alternating subtle backgrounds -->
          @for (row of [1, 2, 3, 4, 5]; track $index) {
            <div class="flex space-x-4 p-3 rounded-lg" [class]="$index % 2 === 0 ? 'bg-white' : 'bg-gray-50'">
              @for (col of [1, 2, 3, 4]; track $index) {
                <div class="h-5 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded flex-1"></div>
              }
            </div>
          }
        </div>
      }

      @if (type === 'card') {
        <!-- Card skeleton with modern card styling -->
        <div class="p-6 space-y-4 bg-white rounded-2xl border border-gray-100 shadow-sm animate-fadeIn">
          <!-- Title with gradient shimmer -->
          <div class="h-6 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-lg w-2/3 shadow-sm"></div>

          <!-- Content lines -->
          @for (line of [1, 2, 3]; track $index) {
            <div class="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded w-full"></div>
          }

          <!-- Button placeholder with gradient -->
          <div class="h-10 bg-gradient-to-r from-blue-200 via-purple-200 to-blue-200 bg-[length:200%_100%] animate-shimmer rounded-lg w-24 shadow-sm"></div>
        </div>
      }
    </div>
  `,
})
export class LoadingSkeletonComponent {
  @Input() type: 'chart' | 'table' | 'card' = 'chart';
  @Input() height = '400px';
}
