import { Component, ChangeDetectionStrategy, inject, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatStateService } from '../../core/services/chat-state.service';
import { ConversationService } from '../../core/services/conversation.service';
import { ThreadDrawerComponent } from './thread-drawer.component';

/**
 * HeaderBarComponent
 *
 * Displays app title, connection status, and thread drawer toggle.
 * Connection status derives from ChatStateService.isStreaming signal.
 */
@Component({
  selector: 'app-header-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ThreadDrawerComponent],
  template: `
    <header
      class="h-14 bg-white border-b border-gray-200 px-4 flex items-center justify-between shadow-sm">
      <div class="flex items-center gap-3">
        <!-- Hamburger menu button -->
        <button
          (click)="toggleDrawer()"
          class="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Open conversations">
          <svg class="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 class="text-xl font-semibold text-gray-800">Analytics Agent</h1>
      </div>

      <div class="flex items-center gap-4">
        <!-- Connection status indicator -->
        <div class="flex items-center gap-2">
          <div
            class="w-2 h-2 rounded-full transition-colors"
            [ngClass]="{
              'bg-green-500': connectionStatus() === 'connected',
              'bg-blue-500 animate-pulse': connectionStatus() === 'streaming',
              'bg-red-500': connectionStatus() === 'error'
            }"></div>
          <span class="text-sm text-gray-600">{{ connectionStatusText() }}</span>
        </div>

        <!-- Settings gear (placeholder for future) -->
        <button
          class="p-2 rounded hover:bg-gray-100 transition-colors"
          title="Settings (coming soon)">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </header>

    <!-- Thread drawer (fixed overlay, outside header flow) -->
    <app-thread-drawer
      [isOpen]="drawerOpen()"
      (closed)="drawerOpen.set(false)" />
  `,
})
export class HeaderBarComponent implements OnInit {
  private chatState = inject(ChatStateService);
  private conversation = inject(ConversationService);

  protected drawerOpen = signal(false);

  // Derive connection status from chat state
  protected connectionStatus = computed<'connected' | 'streaming' | 'error'>(() => {
    if (this.chatState.error()) return 'error';
    if (this.chatState.isStreaming()) return 'streaming';
    return 'connected';
  });

  protected connectionStatusText = computed(() => {
    const status = this.connectionStatus();
    switch (status) {
      case 'streaming':
        return 'Streaming...';
      case 'error':
        return 'Error';
      default:
        return 'Connected';
    }
  });

  ngOnInit(): void {
    // Initialize conversation service (restore last thread, load sidebar)
    this.conversation.init();
  }

  protected toggleDrawer(): void {
    const opening = !this.drawerOpen();
    this.drawerOpen.set(opening);
    if (opening) {
      // Refresh thread list when opening drawer
      this.conversation.loadThreads();
    }
  }
}
