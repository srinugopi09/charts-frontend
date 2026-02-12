import { Component, ChangeDetectionStrategy, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * MobileToggleComponent
 *
 * Floating toggle button for mobile/tablet to switch between chat and canvas views.
 * Visible only on small screens (md:hidden).
 */
@Component({
  selector: 'app-mobile-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="fixed bottom-20 right-4 md:hidden z-50">
      <button
        (click)="toggle()"
        class="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        [title]="activeView() === 'chat' ? 'View Canvas' : 'View Chat'">
        @if (activeView() === 'chat') {
          <!-- Chart icon -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        } @else {
          <!-- Chat icon -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        }
      </button>
    </div>
  `,
})
export class MobileToggleComponent {
  readonly activeView = signal<'chat' | 'canvas'>('chat');
  readonly viewChanged = output<'chat' | 'canvas'>();

  toggle(): void {
    const newView = this.activeView() === 'chat' ? 'canvas' : 'chat';
    this.activeView.set(newView);
    this.viewChanged.emit(newView);
  }
}
