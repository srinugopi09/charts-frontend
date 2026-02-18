import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatStateService } from '../../core/services/chat-state.service';
import { AutoScrollDirective } from '../../shared/directives/auto-scroll.directive';
import { MessageBubbleComponent } from './message-bubble.component';

/**
 * MessageListComponent
 *
 * Displays the list of chat messages with auto-scroll behavior.
 */
@Component({
  selector: 'app-message-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, AutoScrollDirective, MessageBubbleComponent],
  template: `
    <div class="h-full overflow-y-auto px-6 py-8 bg-gradient-to-b from-gray-50 to-white" appAutoScroll>
      <div class="max-w-4xl mx-auto">
        @if (!hasMessages()) {
          <!-- Empty state -->
          <div class="h-full min-h-[400px] flex items-center justify-center text-gray-500">
            <div class="text-center animate-fadeIn">
              <div class="mx-auto h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-6 shadow-lg">
                <svg
                  class="h-10 w-10 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p class="text-xl font-semibold text-gray-800 mb-2">Start a conversation</p>
              <p class="text-sm text-gray-500 max-w-sm mx-auto">Ask questions about your data and get instant insights with interactive visualizations</p>
            </div>
          </div>
        } @else {
          <div class="space-y-4">
            @for (message of messages(); track message.id) {
              <app-message-bubble [message]="message" />
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class MessageListComponent {
  private chatState = inject(ChatStateService);
  protected readonly messages = this.chatState.messages;
  protected readonly hasMessages = computed(() => this.messages().length > 0);
}
